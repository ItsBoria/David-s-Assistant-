import { describe, expect, it } from "vitest";

import {
  generatedMissionOccurrencesResultSchema,
  generateMissionOccurrencesSchema,
} from "../../src/lib/validation/recurrence";

describe("recurrence service validation", () => {
  it("accepts a UUID and real local through date", () => {
    expect(
      generateMissionOccurrencesSchema.parse({
        missionId: "00000000-0000-4000-8000-000000000901",
        throughDate: "2028-02-29",
      }),
    ).toEqual({
      missionId: "00000000-0000-4000-8000-000000000901",
      throughDate: "2028-02-29",
    });
  });

  it("rejects malformed identifiers, rollover dates, and extra input", () => {
    expect(
      generateMissionOccurrencesSchema.safeParse({
        missionId: "not-a-uuid",
        throughDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      generateMissionOccurrencesSchema.safeParse({
        extra: true,
        missionId: "00000000-0000-4000-8000-000000000901",
        throughDate: "2026-07-20",
      }).success,
    ).toBe(false);
  });

  it("rejects a database result whose count does not match its rows", () => {
    expect(
      generatedMissionOccurrencesResultSchema.safeParse({
        correlationId: "00000000-0000-4000-8000-000000000910",
        createdCount: 1,
        exhausted: false,
        generatedThrough: "2026-07-20",
        missionId: "00000000-0000-4000-8000-000000000901",
        occurrences: [],
        recurrenceRuleId: "00000000-0000-4000-8000-000000000900",
      }).success,
    ).toBe(false);
  });
});
