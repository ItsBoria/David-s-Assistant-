/**
 * Serializable primitives shared by the domain layer.
 *
 * Dates and times remain strings at service boundaries so they can cross React,
 * Edge Function, and database boundaries without losing information. Constructors
 * and validation for local dates live in `src/lib/dates`.
 */
export type EntityId = string;
export type UserId = string;
export type UtcIsoDateTime = string;
export type LocalDate = `${number}-${number}-${number}`;
export type LocalTime = `${number}:${number}`;

export const SourceChannel = {
  WEB: "web",
  TELEGRAM: "telegram",
  SYSTEM: "system",
  API: "api",
} as const;

export type SourceChannel =
  (typeof SourceChannel)[keyof typeof SourceChannel];

export interface EntityTimestamps {
  createdAt: UtcIsoDateTime;
  updatedAt: UtcIsoDateTime;
}

export interface OwnedEntity extends EntityTimestamps {
  id: EntityId;
  ownerId: UserId;
}

export interface TimeRange {
  startsAt: UtcIsoDateTime;
  endsAt: UtcIsoDateTime;
}

export const Weekday = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const;

export type Weekday = (typeof Weekday)[keyof typeof Weekday];
export type WorkWeekday = 0 | 1 | 2 | 3 | 4;

export const WORK_WEEKDAYS = [
  Weekday.SUNDAY,
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
] as const satisfies readonly WorkWeekday[];

export function isWeekday(value: unknown): value is Weekday {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= Weekday.SUNDAY &&
    value <= Weekday.SATURDAY
  );
}

export function isWorkWeekday(value: unknown): value is WorkWeekday {
  return isWeekday(value) && value <= Weekday.THURSDAY;
}

export function assertNever(value: never, context = "Unexpected variant"): never {
  throw new Error(`${context}: ${JSON.stringify(value)}`);
}
