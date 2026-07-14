import type {
  EntityId,
  LocalDate,
  LocalTime,
  OwnedEntity,
  TimeRange,
  Weekday,
} from "./shared";

export interface WorkPeriod {
  id?: EntityId;
  startsAt: LocalTime;
  endsAt: LocalTime;
}

export const DateOverrideKind = {
  CUSTOM_HOURS: "custom_hours",
  DAY_OFF: "day_off",
} as const;

export type DateOverrideKind =
  (typeof DateOverrideKind)[keyof typeof DateOverrideKind];

export interface WeeklyWorkSchedule extends OwnedEntity {
  timezone: string;
  periodsByWeekday: Readonly<Partial<Record<Weekday, readonly WorkPeriod[]>>>;
  minimumBufferMinutes: number;
  maximumMissionMinutesPerDay: number | null;
  maximumMeetingMinutesPerDay: number | null;
  maximumScheduledMinutesPerDay: number | null;
}

interface ScheduleOverrideBase extends OwnedEntity {
  date: LocalDate;
  unavailablePeriods: readonly TimeRange[];
}

export interface DayOffScheduleOverride extends ScheduleOverrideBase {
  kind: typeof DateOverrideKind.DAY_OFF;
  periods: readonly [];
}

export interface CustomHoursScheduleOverride extends ScheduleOverrideBase {
  kind: typeof DateOverrideKind.CUSTOM_HOURS;
  periods: readonly WorkPeriod[];
}

export type DateScheduleOverride =
  | DayOffScheduleOverride
  | CustomHoursScheduleOverride;

export interface UnavailablePeriod extends OwnedEntity, TimeRange {
  reason: string | null;
  kind: "break" | "travel" | "personal" | "unavailable";
}
