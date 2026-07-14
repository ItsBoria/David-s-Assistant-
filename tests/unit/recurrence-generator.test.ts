import { describe, expect, it } from "vitest";

import {
  generateRecurrenceOccurrences,
  type RecurrenceGenerationRule,
} from "../../src/lib/recurrence";

function generate(
  rule: RecurrenceGenerationRule,
  startsOn: `${number}-${number}-${number}`,
  endsOn: `${number}-${number}-${number}`,
) {
  return generateRecurrenceOccurrences({
    range: { endsOn, startsOn },
    rule,
  });
}

describe("recurrence occurrence generation", () => {
  it("generates a stable daily cadence with sequence numbers and keys", () => {
    const result = generate(
      {
        active: true,
        end: { kind: "never" },
        pattern: { frequency: "daily", intervalDays: 2 },
        startsOn: "2026-07-01",
      },
      "2026-07-04",
      "2026-07-10",
    );

    expect(result.occurrences).toEqual([
      {
        occurrenceDate: "2026-07-05",
        recurrenceKey: "date:2026-07-05",
        sequenceNumber: 3,
      },
      {
        occurrenceDate: "2026-07-07",
        recurrenceKey: "date:2026-07-07",
        sequenceNumber: 4,
      },
      {
        occurrenceDate: "2026-07-09",
        recurrenceKey: "date:2026-07-09",
        sequenceNumber: 5,
      },
    ]);
    expect(result).toMatchObject({
      exhausted: false,
      generatedThrough: "2026-07-10",
      occurrenceCount: 5,
    });
  });

  it("treats Sunday through Thursday as workdays", () => {
    const result = generate(
      {
        active: true,
        end: { kind: "never" },
        pattern: { frequency: "workdays" },
        startsOn: "2026-07-16",
      },
      "2026-07-16",
      "2026-07-20",
    );

    expect(result.occurrences.map((item) => item.occurrenceDate)).toEqual([
      "2026-07-16",
      "2026-07-19",
      "2026-07-20",
    ]);
  });

  it("anchors multi-week rules to the Sunday containing the start", () => {
    const result = generate(
      {
        active: true,
        end: { kind: "never" },
        pattern: {
          frequency: "weekly",
          intervalWeeks: 2,
          weekdays: [0, 2],
        },
        startsOn: "2026-07-14",
      },
      "2026-07-01",
      "2026-08-10",
    );

    expect(result.occurrences.map((item) => item.occurrenceDate)).toEqual([
      "2026-07-14",
      "2026-07-26",
      "2026-07-28",
      "2026-08-09",
    ]);
  });

  it("skips monthly dates that do not contain the requested day", () => {
    const result = generate(
      {
        active: true,
        end: { kind: "never" },
        pattern: {
          dayOfMonth: 31,
          frequency: "monthly",
          intervalMonths: 1,
        },
        startsOn: "2026-01-31",
      },
      "2026-01-01",
      "2026-05-31",
    );

    expect(result.occurrences.map((item) => item.occurrenceDate)).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
    ]);
  });

  it("preserves a custom day cadence before applying weekday eligibility", () => {
    const result = generate(
      {
        active: true,
        end: { kind: "never" },
        pattern: {
          frequency: "custom",
          interval: 2,
          unit: "days",
          weekdays: [0, 2, 4],
        },
        startsOn: "2026-07-12",
      },
      "2026-07-12",
      "2026-07-22",
    );

    expect(result.occurrences.map((item) => item.occurrenceDate)).toEqual([
      "2026-07-12",
      "2026-07-14",
      "2026-07-16",
    ]);
  });

  it("supports selected weekdays in custom month intervals", () => {
    const result = generate(
      {
        active: true,
        end: { kind: "never" },
        pattern: {
          frequency: "custom",
          interval: 2,
          unit: "months",
          weekdays: [1],
        },
        startsOn: "2026-01-15",
      },
      "2026-01-01",
      "2026-03-31",
    );

    expect(result.occurrences.map((item) => item.occurrenceDate)).toEqual([
      "2026-01-19",
      "2026-01-26",
      "2026-03-02",
      "2026-03-09",
      "2026-03-16",
      "2026-03-23",
      "2026-03-30",
    ]);
  });

  it("uses the start weekday when a custom week rule omits weekdays", () => {
    const result = generate(
      {
        active: true,
        end: { kind: "never" },
        pattern: { frequency: "custom", interval: 3, unit: "weeks" },
        startsOn: "2026-07-17",
      },
      "2026-07-01",
      "2026-08-31",
    );

    expect(result.occurrences.map((item) => item.occurrenceDate)).toEqual([
      "2026-07-17",
      "2026-08-07",
      "2026-08-28",
    ]);
  });

  it("includes an on-date ending and then reports the series exhausted", () => {
    const result = generate(
      {
        active: true,
        end: { date: "2026-07-03", kind: "on_date" },
        pattern: { frequency: "daily", intervalDays: 1 },
        startsOn: "2026-07-01",
      },
      "2026-07-01",
      "2026-07-10",
    );

    expect(result.occurrences.map((item) => item.occurrenceDate)).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
    expect(result.exhausted).toBe(true);
    expect(result.generatedThrough).toBe("2026-07-03");
  });

  it("honors a maximum count even when the requested window starts later", () => {
    const result = generate(
      {
        active: true,
        end: { count: 3, kind: "after_occurrences" },
        pattern: { frequency: "daily", intervalDays: 1 },
        startsOn: "2026-07-01",
      },
      "2026-07-03",
      "2026-07-10",
    );

    expect(result.occurrences).toEqual([
      {
        occurrenceDate: "2026-07-03",
        recurrenceKey: "date:2026-07-03",
        sequenceNumber: 3,
      },
    ]);
    expect(result.occurrenceCount).toBe(3);
    expect(result.exhausted).toBe(true);
  });

  it("continues from an incremental cursor without repeating old dates", () => {
    const rule: RecurrenceGenerationRule = {
      active: true,
      end: { kind: "never" },
      pattern: { frequency: "daily", intervalDays: 1 },
      startsOn: "2026-07-01",
    };
    const first = generateRecurrenceOccurrences({
      range: { endsOn: "2026-07-03", startsOn: "2026-07-01" },
      rule,
    });
    const second = generateRecurrenceOccurrences({
      cursor: {
        generatedThrough: first.generatedThrough,
        occurrenceCount: first.occurrenceCount,
      },
      range: { endsOn: "2026-07-06", startsOn: "2026-07-01" },
      rule,
    });

    expect(first.occurrences.map((item) => item.occurrenceDate)).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
    expect(second.occurrences).toMatchObject([
      { occurrenceDate: "2026-07-04", sequenceNumber: 4 },
      { occurrenceDate: "2026-07-05", sequenceNumber: 5 },
      { occurrenceDate: "2026-07-06", sequenceNumber: 6 },
    ]);
  });

  it("exhausts a count-limited rule from an incremental cursor", () => {
    const result = generateRecurrenceOccurrences({
      cursor: { generatedThrough: "2026-07-02", occurrenceCount: 2 },
      range: { endsOn: "2026-07-10", startsOn: "2026-07-01" },
      rule: {
        active: true,
        end: { count: 3, kind: "after_occurrences" },
        pattern: { frequency: "daily", intervalDays: 1 },
        startsOn: "2026-07-01",
      },
    });

    expect(result.occurrences).toMatchObject([
      { occurrenceDate: "2026-07-03", sequenceNumber: 3 },
    ]);
    expect(result).toMatchObject({
      exhausted: true,
      generatedThrough: "2026-07-03",
      occurrenceCount: 3,
    });
  });

  it("returns no work for an already processed range", () => {
    const result = generateRecurrenceOccurrences({
      cursor: { generatedThrough: "2026-07-10", occurrenceCount: 10 },
      range: { endsOn: "2026-07-10", startsOn: "2026-07-01" },
      rule: {
        active: true,
        end: { kind: "never" },
        pattern: { frequency: "daily", intervalDays: 1 },
        startsOn: "2026-07-01",
      },
    });

    expect(result.occurrences).toEqual([]);
    expect(result.generatedThrough).toBe("2026-07-10");
    expect(result.occurrenceCount).toBe(10);
  });

  it("does not generate inactive rules", () => {
    const result = generate(
      {
        active: false,
        end: { kind: "never" },
        pattern: { frequency: "daily", intervalDays: 1 },
        startsOn: "2026-07-01",
      },
      "2026-07-01",
      "2026-07-10",
    );

    expect(result.occurrences).toEqual([]);
    expect(result.exhausted).toBe(true);
  });

  it("rejects invalid dates, intervals, weekdays, endings, and cursors", () => {
    const base: RecurrenceGenerationRule = {
      active: true,
      end: { kind: "never" },
      pattern: { frequency: "daily", intervalDays: 1 },
      startsOn: "2026-07-01",
    };

    expect(() =>
      generateRecurrenceOccurrences({
        range: { endsOn: "2026-07-01", startsOn: "2026-07-02" },
        rule: base,
      }),
    ).toThrow(/end cannot precede/i);
    expect(() =>
      generateRecurrenceOccurrences({
        range: { endsOn: "2026-07-10", startsOn: "2026-07-01" },
        rule: {
          ...base,
          pattern: { frequency: "daily", intervalDays: 0 },
        },
      }),
    ).toThrow(/daily interval/i);
    expect(() =>
      generateRecurrenceOccurrences({
        range: { endsOn: "2026-07-10", startsOn: "2026-07-01" },
        rule: {
          ...base,
          pattern: {
            frequency: "weekly",
            intervalWeeks: 1,
            weekdays: [1, 1],
          },
        },
      }),
    ).toThrow(/unique/i);
    expect(() =>
      generateRecurrenceOccurrences({
        range: { endsOn: "2026-07-10", startsOn: "2026-07-01" },
        rule: {
          ...base,
          end: { date: "2026-06-30", kind: "on_date" },
        },
      }),
    ).toThrow(/cannot precede/i);
    expect(() =>
      generateRecurrenceOccurrences({
        cursor: { generatedThrough: "2026-07-01", occurrenceCount: -1 },
        range: { endsOn: "2026-07-10", startsOn: "2026-07-01" },
        rule: base,
      }),
    ).toThrow(/non-negative/i);
  });
});
