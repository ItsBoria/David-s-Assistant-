import type {
  LocalDate,
  TimeRange,
  UtcIsoDateTime,
} from "../domain/shared";
import type {
  MissionPriority,
  MissionScheduleConstraint,
  MissionSplitPolicy,
} from "../domain/mission";

/** A work interval already resolved from civil time into an unambiguous UTC range. */
export interface PlanningWindow extends TimeRange {
  localDate: LocalDate;
}

export const BlockingPeriodKind = {
  MEETING: "meeting",
  UNAVAILABLE: "unavailable",
  LOCKED_MISSION: "locked_mission",
  OTHER: "other",
} as const;

export type BlockingPeriodKind =
  (typeof BlockingPeriodKind)[keyof typeof BlockingPeriodKind];

export interface BlockingPeriod extends TimeRange {
  id: string;
  kind: BlockingPeriodKind;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
}

export interface SchedulingCandidate {
  missionId: string;
  occurrenceId: string;
  title: string;
  priority: MissionPriority;
  estimatedDurationMinutes: number;
  schedule: MissionScheduleConstraint;
  splitPolicy: MissionSplitPolicy;
  /** Locked occurrences must be supplied as preserved blocking periods, not moved. */
  locked: boolean;
  createdAt: UtcIsoDateTime;
  rescheduleCount: number;
}

export interface PlannerPreferences {
  /** Time reserved around newly planned mission sessions. */
  missionBufferMinutes?: number;
  /** Total mission minutes permitted on one civil date. */
  maximumDailyMissionMinutes?: number;
  /** Mission minutes already committed outside the candidate set, keyed by local date. */
  committedMissionMinutesByDate?: Readonly<Partial<Record<LocalDate, number>>>;
}

export interface PlannerInput {
  now: UtcIsoDateTime;
  workWindows: readonly PlanningWindow[];
  blockingPeriods: readonly BlockingPeriod[];
  candidates: readonly SchedulingCandidate[];
  preferences?: PlannerPreferences;
}

export interface PlannedSession extends TimeRange {
  missionId: string;
  occurrenceId: string;
  localDate: LocalDate;
  sessionIndex: number;
}

export interface ScheduledMissionResult {
  missionId: string;
  occurrenceId: string;
  sessions: readonly PlannedSession[];
  split: boolean;
}

export const UnscheduledReason = {
  DEADLINE_PASSED: "deadline_passed",
  NO_ALLOWED_DAY: "no_allowed_day",
  NO_AVAILABLE_WORK_HOURS: "no_available_work_hours",
  FIXED_TIME_CONFLICT: "fixed_time_conflict",
  DURATION_CANNOT_FIT: "duration_cannot_fit",
  MINIMUM_SESSION_DURATION_CANNOT_FIT:
    "minimum_session_duration_cannot_fit",
  MAXIMUM_DAILY_MISSION_MINUTES_REACHED:
    "maximum_daily_mission_minutes_reached",
  LOCKED_MISSION_HAS_NO_PRESERVED_SESSION:
    "locked_mission_has_no_preserved_session",
} as const;

export type UnscheduledReason =
  (typeof UnscheduledReason)[keyof typeof UnscheduledReason];

export interface UnscheduledMissionResult {
  missionId: string;
  occurrenceId: string;
  reason: UnscheduledReason;
}

export interface PlannerResult {
  scheduled: readonly ScheduledMissionResult[];
  unscheduled: readonly UnscheduledMissionResult[];
}
