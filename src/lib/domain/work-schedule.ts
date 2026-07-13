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
  kind: "day_off";
  periods: readonly [];
}

export interface CustomHoursScheduleOverride extends ScheduleOverrideBase {
  kind: "custom_hours";
  periods: readonly WorkPeriod[];
}

export type DateScheduleOverride =
  | DayOffScheduleOverride
  | CustomHoursScheduleOverride;

export interface UnavailablePeriod extends OwnedEntity, TimeRange {
  reason: string | null;
  kind: "break" | "travel" | "personal" | "unavailable";
}
