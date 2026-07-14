import {
  MissionPriority,
  SchedulingMode,
  hasValidMissionSplitPolicy,
  type MissionScheduleConstraint,
} from "../domain/mission";
import { isWorkWeekday, type LocalDate } from "../domain/shared";
import { parseLocalDate } from "../dates";
import {
  addMinutes,
  durationMinutes,
  normalizePlanningWindows,
  parseInstant,
  reserveRange,
  resolveRange,
  subtractRanges,
  toIso,
  weekdayForLocalDate,
  type ResolvedPlanningWindow,
  type ResolvedRange,
} from "./intervals";
import {
  UnscheduledReason,
  type PlannedSession,
  type PlannerInput,
  type PlannerResult,
  type ScheduledMissionResult,
  type SchedulingCandidate,
  type UnscheduledReason as UnscheduledReasonValue,
} from "./types";

const PRIORITY_RANK: Readonly<Record<MissionPriority, number>> = {
  [MissionPriority.URGENT]: 0,
  [MissionPriority.HIGH]: 1,
  [MissionPriority.MEDIUM]: 2,
  [MissionPriority.LOW]: 3,
};

interface PlannerState {
  freeWindows: ResolvedPlanningWindow[];
  plannedMinutesByDate: Map<LocalDate, number>;
}

interface Placement {
  sessions: PlannedSession[];
  freeWindows: ResolvedPlanningWindow[];
  plannedMinutesByDate: Map<LocalDate, number>;
}

export function planMissions(input: PlannerInput): PlannerResult {
  const nowMs = parseInstant(input.now, "now");
  const preferences = validatePreferences(input);
  const workWindows = normalizePlanningWindows(input.workWindows);
  const blocking = input.blockingPeriods.map((period, index) => {
    assertNonNegativeInteger(
      period.bufferBeforeMinutes ?? 0,
      `blockingPeriods[${index}].bufferBeforeMinutes`,
    );
    assertNonNegativeInteger(
      period.bufferAfterMinutes ?? 0,
      `blockingPeriods[${index}].bufferAfterMinutes`,
    );
    const resolved = resolveRange(period, `blockingPeriods[${index}]`);
    return {
      ...resolved,
      startMs: addMinutes(
        resolved.startMs,
        -(period.bufferBeforeMinutes ?? 0),
      ),
      endMs: addMinutes(resolved.endMs, period.bufferAfterMinutes ?? 0),
    };
  });
  const initialMinutes = new Map<LocalDate, number>(
    Object.entries(preferences.committedMissionMinutesByDate).map(
      ([date, minutes]) => [date as LocalDate, minutes ?? 0],
    ),
  );
  const state: PlannerState = {
    freeWindows: subtractRanges(workWindows, blocking),
    plannedMinutesByDate: initialMinutes,
  };

  const scheduled: ScheduledMissionResult[] = [];
  const unscheduled: PlannerResult["unscheduled"][number][] = [];
  const occurrenceIds = new Set<string>();
  const candidates = input.candidates.map((candidate, index) => {
    validateCandidate(candidate, index);
    if (occurrenceIds.has(candidate.occurrenceId)) {
      throw new RangeError(`Duplicate occurrenceId: ${candidate.occurrenceId}`);
    }
    occurrenceIds.add(candidate.occurrenceId);
    return candidate;
  });

  const fixed = candidates
    .filter((candidate) => candidate.schedule.mode === SchedulingMode.FIXED_TIME)
    .sort(compareFixedCandidates);
  const flexible = candidates
    .filter((candidate) => candidate.schedule.mode !== SchedulingMode.FIXED_TIME)
    .sort((left, right) => compareFlexibleCandidates(left, right, workWindows));

  for (const candidate of [...fixed, ...flexible]) {
    const failure = preflightFailure(candidate, nowMs, workWindows);
    if (failure) {
      unscheduled.push(toUnscheduled(candidate, failure));
      continue;
    }

    if (candidate.locked) {
      unscheduled.push(
        toUnscheduled(
          candidate,
          UnscheduledReason.LOCKED_MISSION_HAS_NO_PRESERVED_SESSION,
        ),
      );
      continue;
    }

    const placement =
      candidate.schedule.mode === SchedulingMode.FIXED_TIME
        ? placeFixed(candidate, state, preferences)
        : placeFlexible(candidate, state, preferences);

    if (!placement) {
      unscheduled.push(
        toUnscheduled(
          candidate,
          explainPlacementFailure(candidate, state, workWindows, preferences),
        ),
      );
      continue;
    }

    state.freeWindows = placement.freeWindows;
    state.plannedMinutesByDate = placement.plannedMinutesByDate;
    scheduled.push({
      missionId: candidate.missionId,
      occurrenceId: candidate.occurrenceId,
      sessions: placement.sessions,
      split: placement.sessions.length > 1,
    });
  }

  return { scheduled, unscheduled };
}

function placeFixed(
  candidate: SchedulingCandidate,
  state: PlannerState,
  preferences: ValidatedPreferences,
): Placement | null {
  if (candidate.schedule.mode !== SchedulingMode.FIXED_TIME) {
    return null;
  }

  const fixed = resolveRange(candidate.schedule, `candidate ${candidate.occurrenceId}`);
  const matchingWindow = state.freeWindows.find(
    (window) =>
      window.startMs <= fixed.startMs &&
      window.endMs >= fixed.endMs &&
      canUseDailyMinutes(
        window.localDate,
        candidate.estimatedDurationMinutes,
        state.plannedMinutesByDate,
        preferences.maximumDailyMissionMinutes,
      ),
  );
  if (!matchingWindow) {
    return null;
  }

  return commitSessions(
    [toSession(candidate, matchingWindow.localDate, 1, fixed.startMs, fixed.endMs)],
    state,
    preferences.missionBufferMinutes,
  );
}

function placeFlexible(
  candidate: SchedulingCandidate,
  state: PlannerState,
  preferences: ValidatedPreferences,
): Placement | null {
  const eligible = eligibleWindows(candidate.schedule, state.freeWindows);
  const whole = eligible.find((window) => {
    const available = availableMinutesBeforeDeadline(candidate.schedule, window);
    return (
      available >= candidate.estimatedDurationMinutes &&
      canUseDailyMinutes(
        window.localDate,
        candidate.estimatedDurationMinutes,
        state.plannedMinutesByDate,
        preferences.maximumDailyMissionMinutes,
      )
    );
  });

  if (whole) {
    const startsAt = whole.startMs;
    const endsAt = addMinutes(startsAt, candidate.estimatedDurationMinutes);
    return commitSessions(
      [toSession(candidate, whole.localDate, 1, startsAt, endsAt)],
      state,
      preferences.missionBufferMinutes,
    );
  }

  if (!candidate.splitPolicy.splittable) {
    return null;
  }

  return findSplitPlacement(candidate, state, preferences);
}

function findSplitPlacement(
  candidate: SchedulingCandidate,
  state: PlannerState,
  preferences: ValidatedPreferences,
): Placement | null {
  const minimum = candidate.splitPolicy.minimumSessionMinutes!;
  const maximum =
    candidate.splitPolicy.maximumSessionMinutes ??
    candidate.estimatedDurationMinutes;
  const fewestSessions = Math.max(
    2,
    Math.ceil(candidate.estimatedDurationMinutes / maximum),
  );
  const mostSessions = Math.min(
    candidate.splitPolicy.maximumSessions ?? Number.POSITIVE_INFINITY,
    Math.floor(candidate.estimatedDurationMinutes / minimum),
  );

  for (let sessionCount = fewestSessions; sessionCount <= mostSessions; sessionCount += 1) {
    const placement = searchSplit(
      candidate,
      state,
      preferences,
      candidate.estimatedDurationMinutes,
      sessionCount,
      [],
    );
    if (placement) {
      return placement;
    }
  }

  return null;
}

function searchSplit(
  candidate: SchedulingCandidate,
  state: PlannerState,
  preferences: ValidatedPreferences,
  remainingMinutes: number,
  remainingSessions: number,
  sessions: PlannedSession[],
): Placement | null {
  if (remainingSessions === 0) {
    return remainingMinutes === 0
      ? { ...state, sessions }
      : null;
  }

  const minimum = candidate.splitPolicy.minimumSessionMinutes!;
  const maximum =
    candidate.splitPolicy.maximumSessionMinutes ??
    candidate.estimatedDurationMinutes;
  const minimumThisSession = Math.max(
    minimum,
    remainingMinutes - (remainingSessions - 1) * maximum,
  );
  const maximumThisSession = Math.min(
    maximum,
    remainingMinutes - (remainingSessions - 1) * minimum,
  );
  if (minimumThisSession > maximumThisSession) {
    return null;
  }

  const eligible = eligibleWindows(candidate.schedule, state.freeWindows);
  for (const window of eligible) {
    const availableByTime = availableMinutesBeforeDeadline(candidate.schedule, window);
    const availableByCap = remainingDailyMinutes(
      window.localDate,
      state.plannedMinutesByDate,
      preferences.maximumDailyMissionMinutes,
    );
    const maximumForWindow = Math.min(
      maximumThisSession,
      availableByTime,
      availableByCap,
    );

    for (
      let sessionMinutes = maximumForWindow;
      sessionMinutes >= minimumThisSession;
      sessionMinutes -= 1
    ) {
      const session = toSession(
        candidate,
        window.localDate,
        sessions.length + 1,
        window.startMs,
        addMinutes(window.startMs, sessionMinutes),
      );
      const nextState = commitSessions(
        [session],
        state,
        preferences.missionBufferMinutes,
      );
      const result = searchSplit(
        candidate,
        nextState,
        preferences,
        remainingMinutes - sessionMinutes,
        remainingSessions - 1,
        [...sessions, session],
      );
      if (result) {
        return result;
      }
    }
  }

  return null;
}

function commitSessions(
  sessions: readonly PlannedSession[],
  state: PlannerState,
  bufferMinutes: number,
): Placement {
  let freeWindows = state.freeWindows;
  const plannedMinutesByDate = new Map(state.plannedMinutesByDate);

  for (const session of sessions) {
    const resolved = resolveRange(session, `session ${session.occurrenceId}`);
    const reserved: ResolvedRange = {
      ...resolved,
      startMs: addMinutes(resolved.startMs, -bufferMinutes),
      endMs: addMinutes(resolved.endMs, bufferMinutes),
    };
    freeWindows = reserveRange(freeWindows, reserved);
    plannedMinutesByDate.set(
      session.localDate,
      (plannedMinutesByDate.get(session.localDate) ?? 0) + durationMinutes(resolved),
    );
  }

  return { sessions: [...sessions], freeWindows, plannedMinutesByDate };
}

function eligibleWindows(
  schedule: MissionScheduleConstraint,
  windows: readonly ResolvedPlanningWindow[],
): ResolvedPlanningWindow[] {
  return windows
    .filter((window) => isDateEligible(schedule, window.localDate))
    .filter((window) => availableMinutesBeforeDeadline(schedule, window) > 0);
}

function isDateEligible(
  schedule: MissionScheduleConstraint,
  localDate: LocalDate,
): boolean {
  switch (schedule.mode) {
    case SchedulingMode.FIXED_TIME:
      return true;
    case SchedulingMode.SELECTED_DATE:
      return localDate === schedule.date;
    case SchedulingMode.SELECTED_DATES:
      return schedule.dates.includes(localDate);
    case SchedulingMode.SELECTED_WEEKDAYS:
      return (
        schedule.weekdays.includes(weekdayForLocalDate(localDate) as 0 | 1 | 2 | 3 | 4) &&
        (!schedule.earliestDate || localDate >= schedule.earliestDate) &&
        (!schedule.latestDate || localDate <= schedule.latestDate)
      );
    case SchedulingMode.FLEXIBLE_BEFORE_DEADLINE:
      return !schedule.earliestDate || localDate >= schedule.earliestDate;
    case SchedulingMode.FLEXIBLE_DATE_RANGE:
      return localDate >= schedule.earliestDate && localDate <= schedule.latestDate;
  }
}

function availableMinutesBeforeDeadline(
  schedule: MissionScheduleConstraint,
  window: ResolvedPlanningWindow,
): number {
  const deadlineMs = deadlineFor(schedule);
  const endMs = deadlineMs === null ? window.endMs : Math.min(window.endMs, deadlineMs);
  return Math.max(0, Math.floor((endMs - window.startMs) / 60_000));
}

function deadlineFor(schedule: MissionScheduleConstraint): number | null {
  if (schedule.mode === SchedulingMode.FIXED_TIME || schedule.mode === SchedulingMode.SELECTED_DATE) {
    return null;
  }

  return schedule.deadlineAt
    ? parseInstant(schedule.deadlineAt, "schedule.deadlineAt")
    : null;
}

function preflightFailure(
  candidate: SchedulingCandidate,
  nowMs: number,
  workWindows: readonly ResolvedPlanningWindow[],
): UnscheduledReasonValue | null {
  const deadlineMs = deadlineFor(candidate.schedule);
  if (deadlineMs !== null && deadlineMs <= nowMs) {
    return UnscheduledReason.DEADLINE_PASSED;
  }

  if (candidate.schedule.mode === SchedulingMode.FIXED_TIME) {
    return null;
  }

  if (!workWindows.some((window) => isDateEligible(candidate.schedule, window.localDate))) {
    return workWindows.length === 0
      ? UnscheduledReason.NO_AVAILABLE_WORK_HOURS
      : UnscheduledReason.NO_ALLOWED_DAY;
  }

  return null;
}

function explainPlacementFailure(
  candidate: SchedulingCandidate,
  state: PlannerState,
  workWindows: readonly ResolvedPlanningWindow[],
  preferences: ValidatedPreferences,
): UnscheduledReasonValue {
  if (candidate.schedule.mode === SchedulingMode.FIXED_TIME) {
    return UnscheduledReason.FIXED_TIME_CONFLICT;
  }

  const eligibleWork = eligibleWindows(candidate.schedule, workWindows);
  if (eligibleWork.length === 0) {
    return UnscheduledReason.NO_ALLOWED_DAY;
  }

  const eligibleFree = eligibleWindows(candidate.schedule, state.freeWindows);
  if (eligibleFree.length === 0) {
    return UnscheduledReason.NO_AVAILABLE_WORK_HOURS;
  }

  const hasDailyCapacity = eligibleFree.some(
    (window) => remainingDailyMinutes(
      window.localDate,
      state.plannedMinutesByDate,
      preferences.maximumDailyMissionMinutes,
    ) > 0,
  );
  if (!hasDailyCapacity) {
    return UnscheduledReason.MAXIMUM_DAILY_MISSION_MINUTES_REACHED;
  }

  const dates = new Set(eligibleFree.map((window) => window.localDate));
  const capacityAcrossDates = [...dates].reduce(
    (total, date) =>
      total +
      remainingDailyMinutes(
        date,
        state.plannedMinutesByDate,
        preferences.maximumDailyMissionMinutes,
      ),
    0,
  );
  const hasWholeDayCapacity = [...dates].some(
    (date) =>
      remainingDailyMinutes(
        date,
        state.plannedMinutesByDate,
        preferences.maximumDailyMissionMinutes,
      ) >= candidate.estimatedDurationMinutes,
  );
  if (
    (!candidate.splitPolicy.splittable && !hasWholeDayCapacity) ||
    (candidate.splitPolicy.splittable &&
      capacityAcrossDates < candidate.estimatedDurationMinutes)
  ) {
    return UnscheduledReason.MAXIMUM_DAILY_MISSION_MINUTES_REACHED;
  }

  if (candidate.splitPolicy.splittable) {
    return UnscheduledReason.MINIMUM_SESSION_DURATION_CANNOT_FIT;
  }

  return UnscheduledReason.DURATION_CANNOT_FIT;
}

function compareFixedCandidates(
  left: SchedulingCandidate,
  right: SchedulingCandidate,
): number {
  if (
    left.schedule.mode !== SchedulingMode.FIXED_TIME ||
    right.schedule.mode !== SchedulingMode.FIXED_TIME
  ) {
    return 0;
  }

  return (
    parseInstant(left.schedule.startsAt, "fixed startsAt") -
      parseInstant(right.schedule.startsAt, "fixed startsAt") ||
    stableTieBreak(left, right)
  );
}

function compareFlexibleCandidates(
  left: SchedulingCandidate,
  right: SchedulingCandidate,
  workWindows: readonly ResolvedPlanningWindow[],
): number {
  const leftDeadline = deadlineFor(left.schedule) ?? Number.POSITIVE_INFINITY;
  const rightDeadline = deadlineFor(right.schedule) ?? Number.POSITIVE_INFINITY;
  return (
    leftDeadline - rightDeadline ||
    PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority] ||
    right.rescheduleCount - left.rescheduleCount ||
    countEligibleDates(left.schedule, workWindows) -
      countEligibleDates(right.schedule, workWindows) ||
    stableTieBreak(left, right)
  );
}

function stableTieBreak(left: SchedulingCandidate, right: SchedulingCandidate): number {
  return (
    parseInstant(left.createdAt, "candidate.createdAt") -
      parseInstant(right.createdAt, "candidate.createdAt") ||
    left.occurrenceId.localeCompare(right.occurrenceId) ||
    left.missionId.localeCompare(right.missionId)
  );
}

function countEligibleDates(
  schedule: MissionScheduleConstraint,
  windows: readonly ResolvedPlanningWindow[],
): number {
  return new Set(
    windows
      .filter((window) => isDateEligible(schedule, window.localDate))
      .map((window) => window.localDate),
  ).size;
}

function toSession(
  candidate: SchedulingCandidate,
  localDate: LocalDate,
  sessionIndex: number,
  startMs: number,
  endMs: number,
): PlannedSession {
  return {
    missionId: candidate.missionId,
    occurrenceId: candidate.occurrenceId,
    localDate,
    sessionIndex,
    startsAt: toIso(startMs),
    endsAt: toIso(endMs),
  };
}

function toUnscheduled(
  candidate: SchedulingCandidate,
  reason: UnscheduledReasonValue,
): PlannerResult["unscheduled"][number] {
  return {
    missionId: candidate.missionId,
    occurrenceId: candidate.occurrenceId,
    reason,
  };
}

interface ValidatedPreferences {
  missionBufferMinutes: number;
  maximumDailyMissionMinutes: number;
  committedMissionMinutesByDate: Readonly<Partial<Record<LocalDate, number>>>;
}

function validatePreferences(input: PlannerInput): ValidatedPreferences {
  const missionBufferMinutes = input.preferences?.missionBufferMinutes ?? 0;
  const maximumDailyMissionMinutes =
    input.preferences?.maximumDailyMissionMinutes ?? Number.POSITIVE_INFINITY;
  assertNonNegativeInteger(missionBufferMinutes, "missionBufferMinutes");
  if (
    maximumDailyMissionMinutes !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(maximumDailyMissionMinutes) || maximumDailyMissionMinutes <= 0)
  ) {
    throw new RangeError("maximumDailyMissionMinutes must be a positive integer");
  }

  const committed = input.preferences?.committedMissionMinutesByDate ?? {};
  for (const [date, minutes] of Object.entries(committed)) {
    assertNonNegativeInteger(minutes, `committedMissionMinutesByDate.${date}`);
  }

  return {
    missionBufferMinutes,
    maximumDailyMissionMinutes,
    committedMissionMinutesByDate: committed,
  };
}

function validateCandidate(candidate: SchedulingCandidate, index: number): void {
  const label = `candidates[${index}]`;
  if (!Number.isInteger(candidate.estimatedDurationMinutes) || candidate.estimatedDurationMinutes <= 0) {
    throw new RangeError(`${label}.estimatedDurationMinutes must be a positive integer`);
  }
  if (!hasValidMissionSplitPolicy(candidate.estimatedDurationMinutes, candidate.splitPolicy)) {
    throw new RangeError(`${label}.splitPolicy is not feasible`);
  }
  assertNonNegativeInteger(candidate.rescheduleCount, `${label}.rescheduleCount`);
  parseInstant(candidate.createdAt, `${label}.createdAt`);
  validateSchedule(candidate, label);
}

function validateSchedule(candidate: SchedulingCandidate, label: string): void {
  const schedule = candidate.schedule;
  switch (schedule.mode) {
    case SchedulingMode.FIXED_TIME: {
      const fixed = resolveRange(schedule, `${label}.schedule`);
      if (durationMinutes(fixed) !== candidate.estimatedDurationMinutes) {
        throw new RangeError(
          `${label}.schedule duration must equal estimatedDurationMinutes`,
        );
      }
      return;
    }
    case SchedulingMode.SELECTED_DATE:
      parseLocalDate(schedule.date);
      return;
    case SchedulingMode.SELECTED_DATES:
      if (schedule.dates.length === 0 || new Set(schedule.dates).size !== schedule.dates.length) {
        throw new RangeError(`${label}.schedule.dates must be non-empty and unique`);
      }
      schedule.dates.forEach((date) => parseLocalDate(date));
      if (schedule.deadlineAt) {
        parseInstant(schedule.deadlineAt, `${label}.schedule.deadlineAt`);
      }
      return;
    case SchedulingMode.SELECTED_WEEKDAYS:
      if (
        schedule.weekdays.length === 0 ||
        new Set(schedule.weekdays).size !== schedule.weekdays.length ||
        !schedule.weekdays.every(isWorkWeekday)
      ) {
        throw new RangeError(
          `${label}.schedule.weekdays must be unique Sunday-to-Thursday values`,
        );
      }
      if (schedule.earliestDate) parseLocalDate(schedule.earliestDate);
      if (schedule.latestDate) parseLocalDate(schedule.latestDate);
      if (
        schedule.earliestDate &&
        schedule.latestDate &&
        schedule.latestDate < schedule.earliestDate
      ) {
        throw new RangeError(`${label}.schedule date range is reversed`);
      }
      if (schedule.deadlineAt) {
        parseInstant(schedule.deadlineAt, `${label}.schedule.deadlineAt`);
      }
      return;
    case SchedulingMode.FLEXIBLE_BEFORE_DEADLINE:
      if (schedule.earliestDate) parseLocalDate(schedule.earliestDate);
      parseInstant(schedule.deadlineAt, `${label}.schedule.deadlineAt`);
      return;
    case SchedulingMode.FLEXIBLE_DATE_RANGE:
      parseLocalDate(schedule.earliestDate);
      parseLocalDate(schedule.latestDate);
      if (schedule.latestDate < schedule.earliestDate) {
        throw new RangeError(`${label}.schedule date range is reversed`);
      }
      if (schedule.deadlineAt) {
        parseInstant(schedule.deadlineAt, `${label}.schedule.deadlineAt`);
      }
  }
}

function assertNonNegativeInteger(value: unknown, label: string): void {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
}

function canUseDailyMinutes(
  date: LocalDate,
  requestedMinutes: number,
  plannedMinutesByDate: ReadonlyMap<LocalDate, number>,
  maximumDailyMissionMinutes: number,
): boolean {
  return (
    (plannedMinutesByDate.get(date) ?? 0) + requestedMinutes <=
    maximumDailyMissionMinutes
  );
}

function remainingDailyMinutes(
  date: LocalDate,
  plannedMinutesByDate: ReadonlyMap<LocalDate, number>,
  maximumDailyMissionMinutes: number,
): number {
  return Math.max(
    0,
    maximumDailyMissionMinutes - (plannedMinutesByDate.get(date) ?? 0),
  );
}
