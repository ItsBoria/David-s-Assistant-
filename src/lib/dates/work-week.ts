import { isValid as isValidDate } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import {
  WORK_WEEKDAYS,
  isWorkWeekday,
  type LocalDate,
  type LocalTime,
  type UtcIsoDateTime,
  type WorkWeekday,
} from "../domain/shared";

export type DateInput = Date | UtcIsoDateTime | number;

export interface WorkWeekDate {
  localDate: LocalDate;
  weekday: WorkWeekday;
  startsAt: Date;
  endsBefore: Date;
}

export type WorkWeek = readonly [
  WorkWeekDate,
  WorkWeekDate,
  WorkWeekDate,
  WorkWeekDate,
  WorkWeekDate,
];

export interface WorkWeekBounds {
  startsOn: LocalDate;
  endsOn: LocalDate;
  startsAt: Date;
  endsBefore: Date;
  timeZone: string;
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const EXPLICIT_OFFSET_PATTERN = /(?:z|[+-]\d{2}:\d{2})$/i;

export interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.trim() === "") {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function assertValidTimeZone(timeZone: string): string {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Invalid IANA time zone: ${timeZone}`);
  }

  return timeZone;
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") {
    return false;
  }

  try {
    parseLocalDate(value);
    return true;
  } catch {
    return false;
  }
}

export function parseLocalDate(value: string): LocalDateParts {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Invalid local date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Restrict to the interoperable four-digit range and verify calendar rollover.
  if (year < 1000 || year > 9999) {
    throw new RangeError(`Invalid local date: ${value}`);
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid local date: ${value}`);
  }

  return { year, month, day };
}

export function isLocalTime(value: unknown): value is LocalTime {
  return typeof value === "string" && LOCAL_TIME_PATTERN.test(value);
}

export function toLocalDate(input: DateInput, timeZone: string): LocalDate {
  const instant = toValidDate(input);
  assertValidTimeZone(timeZone);
  return formatInTimeZone(instant, timeZone, "yyyy-MM-dd") as LocalDate;
}

/**
 * Converts the first valid instant of a civil date in `timeZone` to UTC.
 *
 * Some zones advance their clocks at 00:00, so converting a literal midnight
 * can round-trip to the previous date. A date can also be skipped completely
 * when a jurisdiction moves across the international date line. Resolve the
 * civil-date boundary itself so the former starts at its first valid wall time
 * and the latter is rejected explicitly.
 */
export function fromLocalDate(localDate: LocalDate, timeZone: string): Date {
  const boundary = findLocalDateBoundary(localDate, timeZone);

  if (boundary.localDate !== localDate) {
    throw new RangeError(
      `Local date ${localDate} does not exist in ${timeZone}`,
    );
  }

  return boundary.instant;
}

/**
 * Converts a local date and wall-clock time into an instant. Non-existent wall
 * times during a daylight-saving jump are rejected instead of silently shifted.
 */
export function fromLocalDateTime(
  localDate: LocalDate,
  localTime: LocalTime,
  timeZone: string,
): Date {
  parseLocalDate(localDate);
  if (!isLocalTime(localTime)) {
    throw new RangeError(`Invalid local time: ${localTime}`);
  }
  assertValidTimeZone(timeZone);

  const instant = fromZonedTime(
    `${localDate}T${localTime}:00.000`,
    timeZone,
  );
  const roundTrip = formatInTimeZone(
    instant,
    timeZone,
    "yyyy-MM-dd HH:mm",
  );

  if (roundTrip !== `${localDate} ${localTime}`) {
    throw new RangeError(
      `Local time ${localDate} ${localTime} does not exist in ${timeZone}`,
    );
  }

  for (let offsetMinutes = 15; offsetMinutes <= 180; offsetMinutes += 15) {
    const offsetMilliseconds = offsetMinutes * 60_000;
    const alternatives = [
      new Date(instant.getTime() - offsetMilliseconds),
      new Date(instant.getTime() + offsetMilliseconds),
    ];

    if (
      alternatives.some(
        (candidate) =>
          formatInTimeZone(candidate, timeZone, "yyyy-MM-dd HH:mm") ===
          `${localDate} ${localTime}`,
      )
    ) {
      throw new RangeError(
        `Local time ${localDate} ${localTime} is ambiguous in ${timeZone}`,
      );
    }
  }

  return instant;
}

export function addLocalDays(localDate: LocalDate, amount: number): LocalDate {
  if (!Number.isInteger(amount)) {
    throw new RangeError("Calendar-day amount must be an integer");
  }

  const { year, month, day } = parseLocalDate(localDate);
  const civilDate = new Date(Date.UTC(year, month - 1, day));
  civilDate.setUTCDate(civilDate.getUTCDate() + amount);
  return formatDateParts({
    year: civilDate.getUTCFullYear(),
    month: civilDate.getUTCMonth() + 1,
    day: civilDate.getUTCDate(),
  });
}

export function getLocalWeekday(
  input: DateInput,
  timeZone: string,
): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const localDate = toLocalDate(input, timeZone);
  const { year, month, day } = parseLocalDate(localDate);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6;
}

export function isWorkday(input: DateInput, timeZone: string): boolean {
  return isWorkWeekday(getLocalWeekday(input, timeZone));
}

export function startOfWorkWeek(input: DateInput, timeZone: string): Date {
  return fromLocalDate(getSundayLocalDate(input, timeZone), timeZone);
}

/** Exclusive Friday boundary for half-open Sunday-to-Friday database queries. */
export function endOfWorkWeekExclusive(
  input: DateInput,
  timeZone: string,
): Date {
  const sunday = getSundayLocalDate(input, timeZone);
  return findLocalDateBoundary(addLocalDays(sunday, 5), timeZone).instant;
}

export function getWorkWeek(input: DateInput, timeZone: string): WorkWeek {
  return getWorkWeekFromSunday(getSundayLocalDate(input, timeZone), timeZone);
}

export function getWorkWeekBounds(
  input: DateInput,
  timeZone: string,
): WorkWeekBounds {
  const days = getWorkWeek(input, timeZone);
  return {
    startsOn: days[0].localDate,
    endsOn: days[4].localDate,
    startsAt: days[0].startsAt,
    endsBefore: days[4].endsBefore,
    timeZone,
  };
}

/** Returns a work week shifted by whole Sunday-based weeks. */
export function shiftWorkWeek(
  input: DateInput,
  timeZone: string,
  amount: number,
): WorkWeek {
  if (!Number.isInteger(amount)) {
    throw new RangeError("Week amount must be an integer");
  }

  const sunday = getSundayLocalDate(input, timeZone);
  return getWorkWeekFromSunday(addLocalDays(sunday, amount * 7), timeZone);
}

/** Finds the start of the next eligible Sunday-to-Thursday workday. */
export function nextWorkdayStart(
  input: DateInput,
  timeZone: string,
  includeCurrent = false,
): Date {
  let localDate = toLocalDate(input, timeZone);
  if (!includeCurrent || !isWorkWeekday(getLocalWeekday(input, timeZone))) {
    localDate = addLocalDays(localDate, 1);
  }

  while (!isWorkWeekday(getWeekdayForLocalDate(localDate))) {
    localDate = addLocalDays(localDate, 1);
  }

  return fromLocalDate(localDate, timeZone);
}

function getWorkWeekFromSunday(
  sunday: LocalDate,
  timeZone: string,
): WorkWeek {
  if (getWeekdayForLocalDate(sunday) !== 0) {
    throw new RangeError(`Expected a Sunday, received ${sunday}`);
  }

  const localDates = [0, 1, 2, 3, 4, 5].map((offset) =>
    addLocalDays(sunday, offset),
  );
  const workdayStarts = localDates
    .slice(0, 5)
    .map((localDate) => fromLocalDate(localDate, timeZone));
  const fridayBoundary = findLocalDateBoundary(localDates[5], timeZone).instant;

  const createDay = (weekday: WorkWeekday): WorkWeekDate => {
    const localDate = localDates[weekday];
    const startsAt = workdayStarts[weekday];
    const endsBefore = workdayStarts[weekday + 1] ?? fridayBoundary;

    return {
      localDate,
      weekday,
      startsAt,
      endsBefore,
    };
  };

  return [
    createDay(WORK_WEEKDAYS[0]),
    createDay(WORK_WEEKDAYS[1]),
    createDay(WORK_WEEKDAYS[2]),
    createDay(WORK_WEEKDAYS[3]),
    createDay(WORK_WEEKDAYS[4]),
  ];
}

function getSundayLocalDate(
  input: DateInput,
  timeZone: string,
): LocalDate {
  const localDate = toLocalDate(input, timeZone);
  return addLocalDays(localDate, -getWeekdayForLocalDate(localDate));
}

function getWeekdayForLocalDate(
  localDate: LocalDate,
): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const { year, month, day } = parseLocalDate(localDate);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6;
}

function formatDateParts({ year, month, day }: LocalDateParts): LocalDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` as LocalDate;
}

function findLocalDateBoundary(
  localDate: LocalDate,
  timeZone: string,
): { instant: Date; localDate: LocalDate } {
  const { year, month, day } = parseLocalDate(localDate);
  assertValidTimeZone(timeZone);

  const hour = 60 * 60 * 1_000;
  const step = 15 * 60 * 1_000;
  const anchor = Date.UTC(year, month - 1, day);
  const searchStartsAt = anchor - 48 * hour;
  const searchEndsAt = anchor + 48 * hour;
  let previous = searchStartsAt;

  for (
    let candidate = searchStartsAt + step;
    candidate <= searchEndsAt;
    candidate += step
  ) {
    const candidateLocalDate = formatInTimeZone(
      candidate,
      timeZone,
      "yyyy-MM-dd",
    ) as LocalDate;

    if (candidateLocalDate >= localDate) {
      let lower = previous;
      let upper = candidate;

      while (upper - lower > 1) {
        const midpoint = lower + Math.floor((upper - lower) / 2);
        const midpointLocalDate = formatInTimeZone(
          midpoint,
          timeZone,
          "yyyy-MM-dd",
        );

        if (midpointLocalDate >= localDate) {
          upper = midpoint;
        } else {
          lower = midpoint;
        }
      }

      const instant = new Date(upper);
      return {
        instant,
        localDate: formatInTimeZone(
          instant,
          timeZone,
          "yyyy-MM-dd",
        ) as LocalDate,
      };
    }

    previous = candidate;
  }

  throw new RangeError(
    `Could not resolve local date ${localDate} in ${timeZone}`,
  );
}

function toValidDate(input: DateInput): Date {
  if (typeof input === "string" && !EXPLICIT_OFFSET_PATTERN.test(input)) {
    throw new RangeError(
      "Instant strings must include an explicit UTC designator or numeric offset",
    );
  }

  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (!isValidDate(date)) {
    throw new RangeError(`Invalid date input: ${String(input)}`);
  }

  return date;
}
