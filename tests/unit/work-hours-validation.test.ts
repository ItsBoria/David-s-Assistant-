import { describe, expect, it } from "vitest";

import {
  saveWorkHoursSchema,
  WorkHoursValidationMessage,
  zodErrorToFieldErrors,
} from "../../src/lib/validation";

const validDays = [
  { enabled: true, endsAt: "17:00", startsAt: "09:00", weekday: 0 },
  { enabled: true, endsAt: "17:00", startsAt: "09:00", weekday: 1 },
  { enabled: true, endsAt: "17:00", startsAt: "09:00", weekday: 2 },
  { enabled: true, endsAt: "17:00", startsAt: "09:00", weekday: 3 },
  { enabled: true, endsAt: "15:00", startsAt: "09:00", weekday: 4 },
];

describe("work-hours validation", () => {
  it("accepts one normal work period for each work-week day", () => {
    const result = saveWorkHoursSchema.parse({ days: validDays });

    expect(result.days).toEqual(validDays);
  });

  it("allows disabled days while preserving their draft times", () => {
    const result = saveWorkHoursSchema.parse({
      days: validDays.map((day) =>
        day.weekday === 2 ? { ...day, enabled: false } : day,
      ),
    });

    expect(result.days[2]).toMatchObject({
      enabled: false,
      endsAt: "17:00",
      startsAt: "09:00",
      weekday: 2,
    });
  });

  it("rejects end times that are not after start times on enabled days", () => {
    const result = saveWorkHoursSchema.safeParse({
      days: validDays.map((day) =>
        day.weekday === 0 ? { ...day, endsAt: "09:00" } : day,
      ),
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(zodErrorToFieldErrors(result.error)).toMatchObject({
        "days.0.endsAt": [WorkHoursValidationMessage.TIME_ORDER],
      });
    }
  });

  it("rejects invalid time input", () => {
    const result = saveWorkHoursSchema.safeParse({
      days: validDays.map((day) =>
        day.weekday === 1 ? { ...day, startsAt: "25:00" } : day,
      ),
    });

    expect(result.success).toBe(false);
  });
});
