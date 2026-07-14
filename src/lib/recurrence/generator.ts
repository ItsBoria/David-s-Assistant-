import { addLocalDays, parseLocalDate } from "@/lib/dates";
import {
  assertNever,
  isWorkWeekday,
  type LocalDate,
  type Weekday,
} from "@/lib/domain/shared";
import type {
  RecurrenceEnd,
  RecurrencePattern,
} from "@/lib/domain/recurrence";

const MAX_INTERVAL = 365;

export type RecurrenceGenerationRule = {
  active: boolean;
  end: RecurrenceEnd;
  pattern: RecurrencePattern;
  startsOn: LocalDate;
};

export type RecurrenceGenerationCursor = {
  generatedThrough: LocalDate;
  occurrenceCount: number;
};

export type GeneratedRecurrenceOccurrence = {
  occurrenceDate: LocalDate;
  recurrenceKey: string;
  sequenceNumber: number;
};

export type RecurrenceGenerationResult = {
  exhausted: boolean;
  generatedThrough: LocalDate;
  occurrenceCount: number;
  occurrences: GeneratedRecurrenceOccurrence[];
};

export function generateRecurrenceOccurrences({
  cursor,
  range,
  rule,
}: {
  cursor?: RecurrenceGenerationCursor;
  range: { endsOn: LocalDate; startsOn: LocalDate };
  rule: RecurrenceGenerationRule;
}): RecurrenceGenerationResult {
  validateRule(rule);
  assertDateRange(range.startsOn, range.endsOn, "generation range");
  validateCursor(cursor);

  if (cursor && cursor.generatedThrough >= range.endsOn) {
    return {
      exhausted: isRuleExhausted(rule, cursor.occurrenceCount, cursor.generatedThrough),
      generatedThrough: cursor.generatedThrough,
      occurrenceCount: cursor.occurrenceCount,
      occurrences: [],
    };
  }

  const priorOccurrenceCount = cursor?.occurrenceCount ?? 0;
  const maximumOccurrences = getMaximumOccurrences(rule.end);
  if (!rule.active || priorOccurrenceCount >= maximumOccurrences) {
    return {
      exhausted: true,
      generatedThrough: cursor?.generatedThrough ?? range.endsOn,
      occurrenceCount: priorOccurrenceCount,
      occurrences: [],
    };
  }

  const scanStartsOn = maxDate(
    rule.startsOn,
    cursor ? addLocalDays(cursor.generatedThrough, 1) : rule.startsOn,
  );
  const endDate = rule.end.kind === "on_date" ? rule.end.date : undefined;
  const scanEndsOn = endDate ? minDate(range.endsOn, endDate) : range.endsOn;

  if (scanStartsOn > scanEndsOn) {
    return {
      exhausted: endDate !== undefined && scanStartsOn > endDate,
      generatedThrough: cursor?.generatedThrough ?? range.endsOn,
      occurrenceCount: priorOccurrenceCount,
      occurrences: [],
    };
  }

  let occurrenceCount = priorOccurrenceCount;
  let exhausted = false;
  let generatedThrough = scanEndsOn;
  const occurrences: GeneratedRecurrenceOccurrence[] = [];

  for (const occurrenceDate of iteratePatternDates(
    rule.pattern,
    rule.startsOn,
    scanStartsOn,
    scanEndsOn,
  )) {
    if (occurrenceCount >= maximumOccurrences) {
      exhausted = true;
      generatedThrough = addLocalDays(occurrenceDate, -1);
      break;
    }

    occurrenceCount += 1;
    if (occurrenceDate >= range.startsOn) {
      occurrences.push({
        occurrenceDate,
        recurrenceKey: `date:${occurrenceDate}`,
        sequenceNumber: occurrenceCount,
      });
    }
  }

  if (occurrenceCount >= maximumOccurrences) {
    exhausted = true;
    generatedThrough =
      occurrences.at(-1)?.occurrenceDate ?? generatedThrough;
  } else if (endDate !== undefined && scanEndsOn >= endDate) {
    exhausted = true;
  }

  return {
    exhausted,
    generatedThrough,
    occurrenceCount,
    occurrences,
  };
}

function* iteratePatternDates(
  pattern: RecurrencePattern,
  anchorDate: LocalDate,
  scanStartsOn: LocalDate,
  scanEndsOn: LocalDate,
): Generator<LocalDate> {
  switch (pattern.frequency) {
    case "daily":
      yield* iterateDayCadence(
        anchorDate,
        scanStartsOn,
        scanEndsOn,
        pattern.intervalDays,
      );
      return;
    case "workdays":
      yield* iterateWorkdays(anchorDate, scanStartsOn, scanEndsOn);
      return;
    case "weekly":
      yield* iterateWeekCadence(
        anchorDate,
        scanStartsOn,
        scanEndsOn,
        pattern.intervalWeeks,
        pattern.weekdays,
      );
      return;
    case "monthly":
      yield* iterateMonthCadence(
        anchorDate,
        scanStartsOn,
        scanEndsOn,
        pattern.intervalMonths,
        pattern.dayOfMonth,
      );
      return;
    case "custom":
      yield* iterateCustomPattern(
        pattern,
        anchorDate,
        scanStartsOn,
        scanEndsOn,
      );
      return;
    default:
      assertNever(pattern, "Unknown recurrence pattern");
  }
}

function* iterateCustomPattern(
  pattern: Extract<RecurrencePattern, { frequency: "custom" }>,
  anchorDate: LocalDate,
  scanStartsOn: LocalDate,
  scanEndsOn: LocalDate,
): Generator<LocalDate> {
  const weekdays = pattern.weekdays;

  switch (pattern.unit) {
    case "days":
      yield* iterateDayCadence(
        anchorDate,
        scanStartsOn,
        scanEndsOn,
        pattern.interval,
        weekdays,
      );
      return;
    case "weeks":
      yield* iterateWeekCadence(
        anchorDate,
        scanStartsOn,
        scanEndsOn,
        pattern.interval,
        weekdays ?? [getWeekday(anchorDate)],
      );
      return;
    case "months":
      if (weekdays) {
        yield* iterateMonthWeekdays(
          anchorDate,
          scanStartsOn,
          scanEndsOn,
          pattern.interval,
          weekdays,
        );
      } else {
        yield* iterateMonthCadence(
          anchorDate,
          scanStartsOn,
          scanEndsOn,
          pattern.interval,
          parseLocalDate(anchorDate).day,
        );
      }
      return;
    default:
      assertNever(pattern.unit, "Unknown custom recurrence unit");
  }
}

function* iterateDayCadence(
  anchorDate: LocalDate,
  scanStartsOn: LocalDate,
  scanEndsOn: LocalDate,
  intervalDays: number,
  weekdays?: readonly Weekday[],
): Generator<LocalDate> {
  const distanceToScan = differenceInDays(anchorDate, scanStartsOn);
  const firstStep = Math.max(0, Math.ceil(distanceToScan / intervalDays));

  for (
    let date = addLocalDays(anchorDate, firstStep * intervalDays);
    date <= scanEndsOn;
    date = addLocalDays(date, intervalDays)
  ) {
    if (!weekdays || weekdays.includes(getWeekday(date))) {
      yield date;
    }
  }
}

function* iterateWorkdays(
  anchorDate: LocalDate,
  scanStartsOn: LocalDate,
  scanEndsOn: LocalDate,
): Generator<LocalDate> {
  for (
    let date = maxDate(anchorDate, scanStartsOn);
    date <= scanEndsOn;
    date = addLocalDays(date, 1)
  ) {
    if (isWorkWeekday(getWeekday(date))) {
      yield date;
    }
  }
}

function* iterateWeekCadence(
  anchorDate: LocalDate,
  scanStartsOn: LocalDate,
  scanEndsOn: LocalDate,
  intervalWeeks: number,
  weekdays: readonly Weekday[],
): Generator<LocalDate> {
  const anchorWeek = addLocalDays(anchorDate, -getWeekday(anchorDate));
  const scanWeek = addLocalDays(scanStartsOn, -getWeekday(scanStartsOn));
  const weeksFromAnchor = Math.max(
    0,
    Math.floor(differenceInDays(anchorWeek, scanWeek) / 7),
  );
  let cycle = Math.floor(weeksFromAnchor / intervalWeeks) * intervalWeeks;
  let weekStartsOn = addLocalDays(anchorWeek, cycle * 7);

  if (addLocalDays(weekStartsOn, 6) < scanStartsOn) {
    cycle += intervalWeeks;
    weekStartsOn = addLocalDays(anchorWeek, cycle * 7);
  }

  const orderedWeekdays = [...new Set(weekdays)].sort((left, right) => left - right);
  for (
    let week = weekStartsOn;
    week <= scanEndsOn;
    week = addLocalDays(week, intervalWeeks * 7)
  ) {
    for (const weekday of orderedWeekdays) {
      const date = addLocalDays(week, weekday);
      if (
        date >= anchorDate &&
        date >= scanStartsOn &&
        date <= scanEndsOn
      ) {
        yield date;
      }
    }
  }
}

function* iterateMonthCadence(
  anchorDate: LocalDate,
  scanStartsOn: LocalDate,
  scanEndsOn: LocalDate,
  intervalMonths: number,
  dayOfMonth: number,
): Generator<LocalDate> {
  for (const monthIndex of iterateCadenceMonths(
    anchorDate,
    scanStartsOn,
    scanEndsOn,
    intervalMonths,
  )) {
    const date = localDateFromMonthIndex(monthIndex, dayOfMonth);
    if (
      date !== undefined &&
      date >= anchorDate &&
      date >= scanStartsOn &&
      date <= scanEndsOn
    ) {
      yield date;
    }
  }
}

function* iterateMonthWeekdays(
  anchorDate: LocalDate,
  scanStartsOn: LocalDate,
  scanEndsOn: LocalDate,
  intervalMonths: number,
  weekdays: readonly Weekday[],
): Generator<LocalDate> {
  const allowedWeekdays = new Set(weekdays);
  for (const monthIndex of iterateCadenceMonths(
    anchorDate,
    scanStartsOn,
    scanEndsOn,
    intervalMonths,
  )) {
    const daysInMonth = getDaysInMonth(monthIndex);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = localDateFromMonthIndex(monthIndex, day);
      if (
        date !== undefined &&
        date >= anchorDate &&
        date >= scanStartsOn &&
        date <= scanEndsOn &&
        allowedWeekdays.has(getWeekday(date))
      ) {
        yield date;
      }
    }
  }
}

function* iterateCadenceMonths(
  anchorDate: LocalDate,
  scanStartsOn: LocalDate,
  scanEndsOn: LocalDate,
  intervalMonths: number,
): Generator<number> {
  const anchorMonth = getMonthIndex(anchorDate);
  const scanMonth = getMonthIndex(scanStartsOn);
  const endMonth = getMonthIndex(scanEndsOn);
  const monthsFromAnchor = Math.max(0, scanMonth - anchorMonth);
  let cycle = Math.floor(monthsFromAnchor / intervalMonths) * intervalMonths;
  if (anchorMonth + cycle < scanMonth) {
    cycle += intervalMonths;
  }

  for (
    let month = anchorMonth + cycle;
    month <= endMonth;
    month += intervalMonths
  ) {
    yield month;
  }
}

function validateRule(rule: RecurrenceGenerationRule): void {
  parseLocalDate(rule.startsOn);
  validateEnd(rule.end, rule.startsOn);

  switch (rule.pattern.frequency) {
    case "daily":
      assertInterval(rule.pattern.intervalDays, "daily interval");
      return;
    case "workdays":
      return;
    case "weekly":
      assertInterval(rule.pattern.intervalWeeks, "weekly interval");
      assertWeekdays(rule.pattern.weekdays, true);
      return;
    case "monthly":
      assertInterval(rule.pattern.intervalMonths, "monthly interval");
      if (
        !Number.isInteger(rule.pattern.dayOfMonth) ||
        rule.pattern.dayOfMonth < 1 ||
        rule.pattern.dayOfMonth > 31
      ) {
        throw new RangeError("Monthly day must be between 1 and 31");
      }
      return;
    case "custom":
      assertInterval(rule.pattern.interval, "custom interval");
      if (rule.pattern.weekdays !== undefined) {
        assertWeekdays(rule.pattern.weekdays, true);
      }
      return;
    default:
      assertNever(rule.pattern, "Unknown recurrence pattern");
  }
}

function validateEnd(end: RecurrenceEnd, startsOn: LocalDate): void {
  switch (end.kind) {
    case "never":
      return;
    case "on_date":
      parseLocalDate(end.date);
      if (end.date < startsOn) {
        throw new RangeError("Recurrence end date cannot precede its start");
      }
      return;
    case "after_occurrences":
      if (!Number.isInteger(end.count) || end.count < 1) {
        throw new RangeError("Maximum occurrences must be a positive integer");
      }
      return;
    default:
      assertNever(end, "Unknown recurrence end");
  }
}

function validateCursor(cursor: RecurrenceGenerationCursor | undefined): void {
  if (!cursor) {
    return;
  }

  parseLocalDate(cursor.generatedThrough);
  if (!Number.isInteger(cursor.occurrenceCount) || cursor.occurrenceCount < 0) {
    throw new RangeError("Cursor occurrence count must be a non-negative integer");
  }
}

function assertDateRange(
  startsOn: LocalDate,
  endsOn: LocalDate,
  label: string,
): void {
  parseLocalDate(startsOn);
  parseLocalDate(endsOn);
  if (endsOn < startsOn) {
    throw new RangeError(`${label} end cannot precede its start`);
  }
}

function assertInterval(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_INTERVAL) {
    throw new RangeError(`${label} must be an integer between 1 and ${MAX_INTERVAL}`);
  }
}

function assertWeekdays(weekdays: readonly Weekday[], requireWorkday: boolean): void {
  if (weekdays.length === 0 || new Set(weekdays).size !== weekdays.length) {
    throw new RangeError("Recurrence weekdays must be non-empty and unique");
  }

  if (
    weekdays.some(
      (weekday) =>
        !Number.isInteger(weekday) ||
        weekday < 0 ||
        weekday > 6 ||
        (requireWorkday && !isWorkWeekday(weekday)),
    )
  ) {
    throw new RangeError("Recurrence weekdays must be Sunday through Thursday");
  }
}

function getMaximumOccurrences(end: RecurrenceEnd): number {
  return end.kind === "after_occurrences" ? end.count : Number.POSITIVE_INFINITY;
}

function isRuleExhausted(
  rule: RecurrenceGenerationRule,
  occurrenceCount: number,
  generatedThrough: LocalDate,
): boolean {
  if (!rule.active) {
    return true;
  }
  if (rule.end.kind === "after_occurrences") {
    return occurrenceCount >= rule.end.count;
  }
  return rule.end.kind === "on_date" && generatedThrough >= rule.end.date;
}

function getWeekday(localDate: LocalDate): Weekday {
  const { day, month, year } = parseLocalDate(localDate);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as Weekday;
}

function differenceInDays(from: LocalDate, to: LocalDate): number {
  return Math.round((toEpochDay(to) - toEpochDay(from)) / 86_400_000);
}

function toEpochDay(localDate: LocalDate): number {
  const { day, month, year } = parseLocalDate(localDate);
  return Date.UTC(year, month - 1, day);
}

function getMonthIndex(localDate: LocalDate): number {
  const { month, year } = parseLocalDate(localDate);
  return year * 12 + month - 1;
}

function getDaysInMonth(monthIndex: number): number {
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function localDateFromMonthIndex(
  monthIndex: number,
  day: number,
): LocalDate | undefined {
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const daysInMonth = getDaysInMonth(monthIndex);
  if (day > daysInMonth) {
    return undefined;
  }

  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` as LocalDate;
}

function minDate(left: LocalDate, right: LocalDate): LocalDate {
  return left <= right ? left : right;
}

function maxDate(left: LocalDate, right: LocalDate): LocalDate {
  return left >= right ? left : right;
}
