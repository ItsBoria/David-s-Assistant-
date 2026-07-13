import type {
  EntityId,
  LocalDate,
  OwnedEntity,
  SourceChannel,
  UtcIsoDateTime,
  UserId,
  WorkWeekday,
} from "./shared";

export const MissionPriority = {
  URGENT: "urgent",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export type MissionPriority =
  (typeof MissionPriority)[keyof typeof MissionPriority];

export const MissionStatus = {
  UNSCHEDULED: "unscheduled",
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  PARTIALLY_COMPLETED: "partially_completed",
  POSTPONED: "postponed",
  NOT_COMPLETED: "not_completed",
  CANCELLED: "cancelled",
} as const;

export type MissionStatus =
  (typeof MissionStatus)[keyof typeof MissionStatus];

export const SchedulingMode = {
  FIXED_TIME: "fixed_time",
  SELECTED_DATE: "selected_date",
  SELECTED_WEEKDAYS: "selected_weekdays",
  SELECTED_DATES: "selected_dates",
  FLEXIBLE_BEFORE_DEADLINE: "flexible_before_deadline",
  FLEXIBLE_DATE_RANGE: "flexible_date_range",
} as const;

export type SchedulingMode =
  (typeof SchedulingMode)[keyof typeof SchedulingMode];

export interface FixedTimeConstraint {
  mode: typeof SchedulingMode.FIXED_TIME;
  startsAt: UtcIsoDateTime;
  endsAt: UtcIsoDateTime;
}

export interface SelectedDateConstraint {
  mode: typeof SchedulingMode.SELECTED_DATE;
  date: LocalDate;
}

export interface SelectedWeekdaysConstraint {
  mode: typeof SchedulingMode.SELECTED_WEEKDAYS;
  weekdays: readonly WorkWeekday[];
  earliestDate?: LocalDate;
  latestDate?: LocalDate;
  deadlineAt?: UtcIsoDateTime;
}

export interface SelectedDatesConstraint {
  mode: typeof SchedulingMode.SELECTED_DATES;
  dates: readonly LocalDate[];
  deadlineAt?: UtcIsoDateTime;
}

export interface FlexibleBeforeDeadlineConstraint {
  mode: typeof SchedulingMode.FLEXIBLE_BEFORE_DEADLINE;
  deadlineAt: UtcIsoDateTime;
  earliestDate?: LocalDate;
}

export interface FlexibleDateRangeConstraint {
  mode: typeof SchedulingMode.FLEXIBLE_DATE_RANGE;
  earliestDate: LocalDate;
  latestDate: LocalDate;
  deadlineAt?: UtcIsoDateTime;
}

export type MissionScheduleConstraint =
  | FixedTimeConstraint
  | SelectedDateConstraint
  | SelectedWeekdaysConstraint
  | SelectedDatesConstraint
  | FlexibleBeforeDeadlineConstraint
  | FlexibleDateRangeConstraint;

export interface MissionSplitPolicy {
  splittable: boolean;
  minimumSessionMinutes?: number;
  maximumSessionMinutes?: number;
  maximumSessions?: number;
}

export interface Mission extends OwnedEntity {
  title: string;
  description: string | null;
  priority: MissionPriority;
  status: MissionStatus;
  estimatedDurationMinutes: number;
  schedule: MissionScheduleConstraint;
  splitPolicy: MissionSplitPolicy;
  locked: boolean;
  category: string | null;
  notes: string | null;
  recurrenceRuleId: EntityId | null;
}

export interface MissionOccurrence extends OwnedEntity {
  missionId: EntityId;
  recurrenceKey: string;
  occurrenceDate: LocalDate;
  sequenceNumber: number | null;
  status: MissionStatus;
  locked: boolean;
  rescheduleCount: number;
  durationOverrideMinutes: number | null;
  notes: string | null;
  generatedAt: UtcIsoDateTime;
}

/** One scheduled block for an occurrence; split missions may have many. */
export interface MissionSession extends OwnedEntity {
  occurrenceId: EntityId;
  sessionIndex: number;
  startsAt: UtcIsoDateTime;
  endsAt: UtcIsoDateTime;
  status: Exclude<MissionStatus, "unscheduled">;
  locked: boolean;
}

export interface MissionCompletionRecord extends OwnedEntity {
  missionId: EntityId;
  occurrenceId: EntityId;
  completionStatus: Extract<
    MissionStatus,
    "completed" | "partially_completed" | "not_completed"
  >;
  completedAt: UtcIsoDateTime;
  completedBy: UserId | null;
  actualDurationMinutes: number | null;
  completionPercentage: number | null;
  notes: string | null;
  originalScheduledStart: UtcIsoDateTime | null;
  finalScheduledStart: UtcIsoDateTime | null;
  rescheduleCountAtCompletion: number;
  source: SourceChannel;
}

const TERMINAL_STATUSES = new Set<MissionStatus>([
  MissionStatus.COMPLETED,
  MissionStatus.CANCELLED,
]);

export const MISSION_STATUS_TRANSITIONS: Readonly<
  Record<MissionStatus, readonly MissionStatus[]>
> = {
  [MissionStatus.UNSCHEDULED]: [
    MissionStatus.PLANNED,
    MissionStatus.IN_PROGRESS,
    MissionStatus.COMPLETED,
    MissionStatus.PARTIALLY_COMPLETED,
    MissionStatus.POSTPONED,
    MissionStatus.NOT_COMPLETED,
    MissionStatus.CANCELLED,
  ],
  [MissionStatus.PLANNED]: [
    MissionStatus.UNSCHEDULED,
    MissionStatus.IN_PROGRESS,
    MissionStatus.COMPLETED,
    MissionStatus.PARTIALLY_COMPLETED,
    MissionStatus.POSTPONED,
    MissionStatus.NOT_COMPLETED,
    MissionStatus.CANCELLED,
  ],
  [MissionStatus.IN_PROGRESS]: [
    MissionStatus.PLANNED,
    MissionStatus.COMPLETED,
    MissionStatus.PARTIALLY_COMPLETED,
    MissionStatus.POSTPONED,
    MissionStatus.NOT_COMPLETED,
    MissionStatus.CANCELLED,
  ],
  [MissionStatus.PARTIALLY_COMPLETED]: [
    MissionStatus.PLANNED,
    MissionStatus.IN_PROGRESS,
    MissionStatus.COMPLETED,
    MissionStatus.POSTPONED,
    MissionStatus.NOT_COMPLETED,
    MissionStatus.CANCELLED,
  ],
  [MissionStatus.POSTPONED]: [
    MissionStatus.UNSCHEDULED,
    MissionStatus.PLANNED,
    MissionStatus.NOT_COMPLETED,
    MissionStatus.CANCELLED,
  ],
  [MissionStatus.NOT_COMPLETED]: [
    MissionStatus.UNSCHEDULED,
    MissionStatus.PLANNED,
    MissionStatus.CANCELLED,
  ],
  [MissionStatus.COMPLETED]: [],
  [MissionStatus.CANCELLED]: [],
};

export function isTerminalMissionStatus(status: MissionStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Same-state transitions are accepted to make status commands idempotent. */
export function canTransitionMissionStatus(
  from: MissionStatus,
  to: MissionStatus,
): boolean {
  return from === to || MISSION_STATUS_TRANSITIONS[from].includes(to);
}

export function hasValidMissionSplitPolicy(
  estimatedDurationMinutes: number,
  policy: MissionSplitPolicy,
): boolean {
  if (!Number.isInteger(estimatedDurationMinutes) || estimatedDurationMinutes <= 0) {
    return false;
  }

  if (!policy.splittable) {
    return (
      policy.minimumSessionMinutes === undefined &&
      policy.maximumSessionMinutes === undefined &&
      policy.maximumSessions === undefined
    );
  }

  const minimum = policy.minimumSessionMinutes;
  if (minimum === undefined || !Number.isInteger(minimum) || minimum <= 0) {
    return false;
  }

  if (minimum > estimatedDurationMinutes) {
    return false;
  }

  if (
    policy.maximumSessionMinutes !== undefined &&
    (!Number.isInteger(policy.maximumSessionMinutes) ||
      policy.maximumSessionMinutes < minimum ||
      policy.maximumSessionMinutes > estimatedDurationMinutes)
  ) {
    return false;
  }

  if (
    policy.maximumSessions !== undefined &&
    (!Number.isInteger(policy.maximumSessions) || policy.maximumSessions < 2)
  ) {
    return false;
  }

  const maximum =
    policy.maximumSessionMinutes ?? estimatedDurationMinutes;
  const sessionsNeededForCapacity = Math.ceil(
    estimatedDurationMinutes / maximum,
  );
  const sessionsAllowedByMinimum = Math.floor(
    estimatedDurationMinutes / minimum,
  );
  const sessionLimit = Math.min(
    sessionsAllowedByMinimum,
    policy.maximumSessions ?? sessionsAllowedByMinimum,
  );

  // A valid partition needs some session count k for which
  // k * minimum <= total <= k * maximum.
  return sessionsNeededForCapacity <= sessionLimit;
}
