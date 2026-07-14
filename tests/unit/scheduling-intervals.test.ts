import { describe, expect, it } from "vitest";

import {
  normalizePlanningWindows,
  resolveRange,
  subtractRanges,
} from "../../src/lib/scheduling";

describe("planner intervals", () => {
  it("merges adjacent same-date work windows and preserves half-open adjacency", () => {
    const windows = normalizePlanningWindows([
      {
        localDate: "2026-07-19",
        startsAt: "2026-07-19T09:00:00.000Z",
        endsAt: "2026-07-19T10:00:00.000Z",
      },
      {
        localDate: "2026-07-19",
        startsAt: "2026-07-19T10:00:00.000Z",
        endsAt: "2026-07-19T12:00:00.000Z",
      },
    ]);

    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({
      startsAt: "2026-07-19T09:00:00.000Z",
      endsAt: "2026-07-19T12:00:00.000Z",
    });

    const free = subtractRanges(windows, [
      resolveRange(
        {
          startsAt: "2026-07-19T10:00:00.000Z",
          endsAt: "2026-07-19T11:00:00.000Z",
        },
        "meeting",
      ),
    ]);
    expect(free.map(({ startsAt, endsAt }) => ({ startsAt, endsAt }))).toEqual([
      {
        startsAt: "2026-07-19T09:00:00.000Z",
        endsAt: "2026-07-19T10:00:00.000Z",
      },
      {
        startsAt: "2026-07-19T11:00:00.000Z",
        endsAt: "2026-07-19T12:00:00.000Z",
      },
    ]);
  });

  it("rejects invalid ranges and impossible civil dates", () => {
    expect(() =>
      resolveRange(
        {
          startsAt: "2026-07-19T10:00:00.000Z",
          endsAt: "2026-07-19T10:00:00.000Z",
        },
        "range",
      ),
    ).toThrow("positive duration");

    expect(() =>
      normalizePlanningWindows([
        {
          localDate: "2026-02-30",
          startsAt: "2026-03-02T09:00:00.000Z",
          endsAt: "2026-03-02T10:00:00.000Z",
        },
      ]),
    ).toThrow("Invalid local date");
  });
});
