import { describe, expect, it } from "vitest";

import {
  addLocalDays,
  endOfWorkWeekExclusive,
  fromLocalDate,
  fromLocalDateTime,
  getWorkWeek,
  getWorkWeekBounds,
  isLocalDate,
  isWorkday,
  nextWorkdayStart,
  shiftWorkWeek,
  startOfWorkWeek,
  toLocalDate,
} from "../../src/lib/dates";

describe("Sunday-to-Thursday work-week math", () => {
  it("finds the same work week from a mid-week instant in the user timezone", () => {
    const reference = new Date("2026-07-08T21:30:00.000Z");
    const bounds = getWorkWeekBounds(reference, "Asia/Jerusalem");

    expect(bounds.startsOn).toBe("2026-07-05");
    expect(bounds.endsOn).toBe("2026-07-09");
    expect(bounds.startsAt.toISOString()).toBe("2026-07-04T21:00:00.000Z");
    expect(bounds.endsBefore.toISOString()).toBe("2026-07-09T21:00:00.000Z");
    expect(startOfWorkWeek(reference, "Asia/Jerusalem")).toEqual(bounds.startsAt);
    expect(endOfWorkWeekExclusive(reference, "Asia/Jerusalem")).toEqual(
      bounds.endsBefore,
    );
  });

  it("keeps local day labels stable through a Sunday DST transition", () => {
    const days = getWorkWeek(
      new Date("2025-03-11T12:00:00.000Z"),
      "America/New_York",
    );

    expect(days.map((day) => day.localDate)).toEqual([
      "2025-03-09",
      "2025-03-10",
      "2025-03-11",
      "2025-03-12",
      "2025-03-13",
    ]);
    expect(days[0].startsAt.toISOString()).toBe("2025-03-09T05:00:00.000Z");
    expect(days[0].endsBefore.toISOString()).toBe("2025-03-10T04:00:00.000Z");
    expect(days[1].startsAt.toISOString()).toBe("2025-03-10T04:00:00.000Z");
  });

  it("shifts by civil weeks rather than fixed millisecond durations", () => {
    const shifted = shiftWorkWeek(
      new Date("2025-03-05T12:00:00.000Z"),
      "America/New_York",
      1,
    );

    expect(shifted[0].localDate).toBe("2025-03-09");
    expect(shifted[4].localDate).toBe("2025-03-13");
  });

  it("rolls Thursday forward to Sunday and can include the current workday", () => {
    const thursday = new Date("2026-07-09T10:00:00.000Z");
    expect(
      toLocalDate(nextWorkdayStart(thursday, "Asia/Jerusalem"), "Asia/Jerusalem"),
    ).toBe("2026-07-12");
    expect(
      toLocalDate(
        nextWorkdayStart(thursday, "Asia/Jerusalem", true),
        "Asia/Jerusalem",
      ),
    ).toBe("2026-07-09");
    expect(isWorkday(thursday, "Asia/Jerusalem")).toBe(true);
  });
});

describe("local date safety", () => {
  it("validates actual calendar dates and handles leap years", () => {
    expect(isLocalDate("2024-02-29")).toBe(true);
    expect(isLocalDate("2025-02-29")).toBe(false);
    expect(isLocalDate("2025-13-01")).toBe(false);
    expect(addLocalDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addLocalDays("2024-02-29", 1)).toBe("2024-03-01");
  });

  it("rejects a nonexistent wall-clock time during a DST jump", () => {
    expect(() =>
      fromLocalDateTime("2025-03-09", "02:30", "America/New_York"),
    ).toThrow(/does not exist/);
    expect(
      fromLocalDateTime(
        "2025-03-09",
        "03:30",
        "America/New_York",
      ).toISOString(),
    ).toBe("2025-03-09T07:30:00.000Z");
  });

  it("rejects an ambiguous wall-clock time during a DST fallback", () => {
    expect(() =>
      fromLocalDateTime("2025-11-02", "01:30", "America/New_York"),
    ).toThrow(/ambiguous/);
    expect(
      fromLocalDateTime(
        "2025-11-02",
        "02:30",
        "America/New_York",
      ).toISOString(),
    ).toBe("2025-11-02T07:30:00.000Z");
  });

  it("uses the first valid instant when a timezone skips local midnight", () => {
    const start = fromLocalDate("2018-11-04", "America/Sao_Paulo");

    expect(start.toISOString()).toBe("2018-11-04T03:00:00.000Z");
    expect(toLocalDate(start, "America/Sao_Paulo")).toBe("2018-11-04");
  });

  it("rejects a skipped civil date while preserving the preceding day boundary", () => {
    expect(() =>
      fromLocalDate("2011-12-30", "Pacific/Apia"),
    ).toThrow(/does not exist/);

    const days = getWorkWeek(
      new Date("2011-12-28T12:00:00.000Z"),
      "Pacific/Apia",
    );

    expect(days[4].localDate).toBe("2011-12-29");
    expect(days[4].endsBefore.toISOString()).toBe(
      "2011-12-30T10:00:00.000Z",
    );
  });

  it("rejects date-only and timezone-naive strings as instant inputs", () => {
    expect(() => toLocalDate("2026-07-11", "America/Los_Angeles")).toThrow(
      /explicit UTC designator or numeric offset/,
    );
    expect(() =>
      toLocalDate("2026-07-11T09:00:00", "America/Los_Angeles"),
    ).toThrow(/explicit UTC designator or numeric offset/);
    expect(
      toLocalDate("2026-07-11T09:00:00+03:00", "Asia/Jerusalem"),
    ).toBe("2026-07-11");
  });
});
