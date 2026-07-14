import { describe, expect, it } from "vitest";

import { arePlanSnapshotsEqual } from "../../src/lib/planning/acceptance";
import { expectedPlanSchema } from "../../src/lib/validation/schedule-plan";

const first = {
  endsAt: "2026-07-19T08:00:00.000Z",
  missionId: "00000000-0000-4000-8000-000000000001",
  startsAt: "2026-07-19T07:00:00.000Z",
};

const second = {
  endsAt: "2026-07-19T09:00:00.000Z",
  missionId: "00000000-0000-4000-8000-000000000002",
  startsAt: "2026-07-19T08:00:00.000Z",
};

describe("plan acceptance snapshot", () => {
  it("accepts only an exact ordered match", () => {
    expect(arePlanSnapshotsEqual([first, second], [first, second])).toBe(true);
    expect(arePlanSnapshotsEqual([first, second], [second, first])).toBe(false);
    expect(
      arePlanSnapshotsEqual([first], [{ ...first, startsAt: second.startsAt }]),
    ).toBe(false);
    expect(arePlanSnapshotsEqual([first], [first, second])).toBe(false);
  });

  it("validates the untrusted expected snapshot boundary", () => {
    expect(expectedPlanSchema.safeParse([first, second]).success).toBe(true);
    expect(expectedPlanSchema.safeParse([]).success).toBe(false);
    expect(expectedPlanSchema.safeParse([first, first]).success).toBe(false);
    expect(
      expectedPlanSchema.safeParse([
        { ...first, startsAt: "2026-07-19T09:00:00.000Z" },
      ]).success,
    ).toBe(false);
    expect(
      expectedPlanSchema.safeParse([{ ...first, unexpected: true }]).success,
    ).toBe(false);
  });
});
