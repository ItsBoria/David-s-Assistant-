import { describe, expect, it } from "vitest";

import {
  MISSION_STATUS_TRANSITIONS,
  MissionPriority,
  MissionStatus,
  NotificationProvider,
  SchedulingMode,
  canTransitionMissionStatus,
  createAppErrorResponse,
  hasValidMissionSplitPolicy,
  isAppErrorResponse,
  isTerminalMissionStatus,
} from "../../src/lib/domain";

describe("persisted domain values", () => {
  it("uses unique, stable snake_case mission values", () => {
    const statuses = Object.values(MissionStatus);
    const modes = Object.values(SchedulingMode);

    expect(new Set(statuses).size).toBe(statuses.length);
    expect(new Set(modes).size).toBe(modes.length);
    expect(statuses).toContain("partially_completed");
    expect(modes).toContain("flexible_before_deadline");
    expect(Object.values(MissionPriority)).toEqual([
      "urgent",
      "high",
      "medium",
      "low",
    ]);
    expect(Object.values(NotificationProvider)).toContain("telegram");
  });

  it("defines a transition table entry for every mission status", () => {
    expect(Object.keys(MISSION_STATUS_TRANSITIONS).sort()).toEqual(
      Object.values(MissionStatus).sort(),
    );
  });
});

describe("mission invariants", () => {
  it("keeps repeated commands idempotent and terminal states closed", () => {
    expect(
      canTransitionMissionStatus(MissionStatus.PLANNED, MissionStatus.PLANNED),
    ).toBe(true);
    expect(
      canTransitionMissionStatus(MissionStatus.PLANNED, MissionStatus.COMPLETED),
    ).toBe(true);
    expect(isTerminalMissionStatus(MissionStatus.COMPLETED)).toBe(true);
    expect(
      canTransitionMissionStatus(MissionStatus.COMPLETED, MissionStatus.PLANNED),
    ).toBe(false);
    expect(
      canTransitionMissionStatus(MissionStatus.CANCELLED, MissionStatus.PLANNED),
    ).toBe(false);
  });

  it("requires coherent bounds for splittable missions", () => {
    expect(
      hasValidMissionSplitPolicy(240, {
        splittable: true,
        minimumSessionMinutes: 60,
        maximumSessionMinutes: 90,
        maximumSessions: 4,
      }),
    ).toBe(true);

    expect(
      hasValidMissionSplitPolicy(60, {
        splittable: true,
        minimumSessionMinutes: 90,
      }),
    ).toBe(false);

    expect(
      hasValidMissionSplitPolicy(60, {
        splittable: false,
        minimumSessionMinutes: 30,
      }),
    ).toBe(false);

    expect(
      hasValidMissionSplitPolicy(240, {
        splittable: true,
        minimumSessionMinutes: 60,
        maximumSessionMinutes: 90,
        maximumSessions: 2,
      }),
    ).toBe(false);

    expect(
      hasValidMissionSplitPolicy(100, {
        splittable: true,
        minimumSessionMinutes: 60,
        maximumSessionMinutes: 70,
      }),
    ).toBe(false);
  });
});

describe("public error contract", () => {
  it("copies field-error arrays and recognizes the serialized response", () => {
    const source = { email: ["validation.email.invalid"] };
    const response = createAppErrorResponse("validation_error", "Invalid input", {
      fieldErrors: source,
      retryable: false,
    });

    source.email.push("later mutation");
    expect(response.fieldErrors?.email).toEqual(["validation.email.invalid"]);
    expect(isAppErrorResponse(response)).toBe(true);
    expect(isAppErrorResponse({ code: "bad", message: "bad", retryable: "no" })).toBe(
      false,
    );
  });
});
