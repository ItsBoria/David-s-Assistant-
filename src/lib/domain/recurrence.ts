import type {
  LocalDate,
  OwnedEntity,
  WorkWeekday,
} from "./shared";

export const RecurrenceFrequency = {
  DAILY: "daily",
  WORKDAYS: "workdays",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  CUSTOM: "custom",
} as const;

export type RecurrenceFrequency =
  (typeof RecurrenceFrequency)[keyof typeof RecurrenceFrequency];

export type RecurrencePattern =
  | { frequency: "daily"; intervalDays: number }
  | { frequency: "workdays" }
  | {
      frequency: "weekly";
      intervalWeeks: number;
      weekdays: readonly WorkWeekday[];
    }
  | {
      frequency: "monthly";
      intervalMonths: number;
      dayOfMonth: number;
    }
  | {
      frequency: "custom";
      interval: number;
      unit: "days" | "weeks" | "months";
      weekdays?: readonly WorkWeekday[];
    };

export type RecurrenceEnd =
  | { kind: "never" }
  | { kind: "on_date"; date: LocalDate }
  | { kind: "after_occurrences"; count: number };

export interface RecurrenceRule extends OwnedEntity {
  startsOn: LocalDate;
  pattern: RecurrencePattern;
  end: RecurrenceEnd;
  timezone: string;
  active: boolean;
}

export const RecurrenceEditScope = {
  THIS_OCCURRENCE: "this_occurrence",
  THIS_AND_FUTURE: "this_and_future",
  ENTIRE_SERIES: "entire_series",
} as const;

export type RecurrenceEditScope =
  (typeof RecurrenceEditScope)[keyof typeof RecurrenceEditScope];
