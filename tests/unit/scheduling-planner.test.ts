import { describe, expect, it } from "vitest";

import {
  MissionPriority,
  SchedulingMode,
  type MissionScheduleConstraint,
} from "../../src/lib/domain";
import {
  BlockingPeriodKind,
  UnscheduledReason,
  planMissions,
  type PlannerInput,
  type PlanningWindow,
  type SchedulingCandidate,
} from "../../src/lib/scheduling";

const SUNDAY = "2026-07-19" as const;
const MONDAY = "2026-07-20" as const;
const CREATED_AT = "2026-07-18T08:00:00.000Z";

function window(
  localDate: typeof SUNDAY | typeof MONDAY,
  startHour: number,
  endHour: number,
): PlanningWindow {
  return {
    localDate,
    startsAt: `${localDate}T${String(startHour).padStart(2, "0")}:00:00.000Z`,
    endsAt: `${localDate}T${String(endHour).padStart(2, "0")}:00:00.000Z`,
  };
}

function candidate(
  occurrenceId: string,
  overrides: Partial<SchedulingCandidate> = {},
): SchedulingCandidate {
  return {
    missionId: `mission-${occurrenceId}`,
    occurrenceId,
    title: occurrenceId,
    priority: MissionPriority.MEDIUM,
    estimatedDurationMinutes: 60,
    schedule: { mode: SchedulingMode.SELECTED_DATE, date: SUNDAY },
    splitPolicy: { splittable: false },
    locked: false,
    createdAt: CREATED_AT,
    rescheduleCount: 0,
    ...overrides,
  };
}

function input(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    now: "2026-07-18T12:00:00.000Z",
    workWindows: [window(SUNDAY, 9, 12), window(MONDAY, 9, 12)],
    blockingPeriods: [],
    candidates: [],
    ...overrides,
  };
}

describe("deterministic mission planner", () => {
  it("subtracts buffered meetings before placing a mission", () => {
    const result = planMissions(
      input({
        blockingPeriods: [
          {
            id: "meeting-1",
            kind: BlockingPeriodKind.MEETING,
            startsAt: "2026-07-19T10:00:00.000Z",
            endsAt: "2026-07-19T11:00:00.000Z",
            bufferBeforeMinutes: 15,
            bufferAfterMinutes: 15,
          },
        ],
        workWindows: [window(SUNDAY, 9, 13)],
        candidates: [candidate("one")],
      }),
    );

    expect(result.scheduled[0]?.sessions[0]).toMatchObject({
      startsAt: "2026-07-19T11:15:00.000Z",
      endsAt: "2026-07-19T12:15:00.000Z",
    });
  });

  it("ranks an earlier deadline before priority, then uses priority", () => {
    const deadlineSchedule: MissionScheduleConstraint = {
      mode: SchedulingMode.FLEXIBLE_BEFORE_DEADLINE,
      deadlineAt: "2026-07-19T12:00:00.000Z",
    };
    const result = planMissions(
      input({
        workWindows: [window(SUNDAY, 9, 11)],
        candidates: [
          candidate("urgent", { priority: MissionPriority.URGENT }),
          candidate("deadline", {
            priority: MissionPriority.LOW,
            schedule: deadlineSchedule,
          }),
        ],
      }),
    );

    expect(result.scheduled.map((mission) => mission.occurrenceId)).toEqual([
      "deadline",
      "urgent",
    ]);
    expect(result.scheduled.map((mission) => mission.sessions[0]?.startsAt)).toEqual([
      "2026-07-19T09:00:00.000Z",
      "2026-07-19T10:00:00.000Z",
    ]);
  });

  it("uses creation time and occurrence id as stable final tie-breakers", () => {
    const result = planMissions(
      input({
        workWindows: [window(SUNDAY, 9, 12)],
        candidates: [
          candidate("z-later", { createdAt: "2026-07-18T09:00:00.000Z" }),
          candidate("b-same"),
          candidate("a-same"),
        ],
      }),
    );

    expect(result.scheduled.map((mission) => mission.occurrenceId)).toEqual([
      "a-same",
      "b-same",
      "z-later",
    ]);
  });

  it("honors selected weekdays and reports an empty eligible date set", () => {
    const result = planMissions(
      input({
        workWindows: [window(SUNDAY, 9, 12)],
        candidates: [
          candidate("monday-only", {
            schedule: {
              mode: SchedulingMode.SELECTED_WEEKDAYS,
              weekdays: [1],
            },
          }),
        ],
      }),
    );

    expect(result.unscheduled).toEqual([
      {
        missionId: "mission-monday-only",
        occurrenceId: "monday-only",
        reason: UnscheduledReason.NO_ALLOWED_DAY,
      },
    ]);
  });

  it("reports expired deadlines without trying to place them", () => {
    const result = planMissions(
      input({
        candidates: [
          candidate("expired", {
            schedule: {
              mode: SchedulingMode.FLEXIBLE_BEFORE_DEADLINE,
              deadlineAt: "2026-07-18T11:59:00.000Z",
            },
          }),
        ],
      }),
    );

    expect(result.unscheduled[0]?.reason).toBe(UnscheduledReason.DEADLINE_PASSED);
  });

  it("distinguishes blocked availability from a task that is too long", () => {
    const blocked = planMissions(
      input({
        workWindows: [window(SUNDAY, 9, 10)],
        blockingPeriods: [
          {
            id: "locked",
            kind: BlockingPeriodKind.LOCKED_MISSION,
            startsAt: "2026-07-19T09:00:00.000Z",
            endsAt: "2026-07-19T10:00:00.000Z",
          },
        ],
        candidates: [candidate("blocked")],
      }),
    );
    const tooLong = planMissions(
      input({
        workWindows: [window(SUNDAY, 9, 10)],
        candidates: [candidate("long", { estimatedDurationMinutes: 90 })],
      }),
    );

    expect(blocked.unscheduled[0]?.reason).toBe(
      UnscheduledReason.NO_AVAILABLE_WORK_HOURS,
    );
    expect(tooLong.unscheduled[0]?.reason).toBe(
      UnscheduledReason.DURATION_CANNOT_FIT,
    );
  });

  it("splits a mission across the earliest valid windows and days", () => {
    const result = planMissions(
      input({
        workWindows: [window(SUNDAY, 9, 11), window(MONDAY, 9, 11)],
        candidates: [
          candidate("split", {
            estimatedDurationMinutes: 240,
            schedule: {
              mode: SchedulingMode.SELECTED_DATES,
              dates: [SUNDAY, MONDAY],
            },
            splitPolicy: {
              splittable: true,
              minimumSessionMinutes: 60,
              maximumSessionMinutes: 120,
              maximumSessions: 3,
            },
          }),
        ],
      }),
    );

    expect(result.scheduled[0]?.split).toBe(true);
    expect(result.scheduled[0]?.sessions).toMatchObject([
      {
        localDate: SUNDAY,
        sessionIndex: 1,
        startsAt: "2026-07-19T09:00:00.000Z",
        endsAt: "2026-07-19T11:00:00.000Z",
      },
      {
        localDate: MONDAY,
        sessionIndex: 2,
        startsAt: "2026-07-20T09:00:00.000Z",
        endsAt: "2026-07-20T11:00:00.000Z",
      },
    ]);
  });

  it("reports when no valid minimum-sized split can fit", () => {
    const result = planMissions(
      input({
        workWindows: [window(SUNDAY, 9, 10), window(MONDAY, 9, 10)],
        candidates: [
          candidate("split", {
            estimatedDurationMinutes: 180,
            schedule: {
              mode: SchedulingMode.SELECTED_DATES,
              dates: [SUNDAY, MONDAY],
            },
            splitPolicy: {
              splittable: true,
              minimumSessionMinutes: 90,
              maximumSessionMinutes: 120,
              maximumSessions: 2,
            },
          }),
        ],
      }),
    );

    expect(result.unscheduled[0]?.reason).toBe(
      UnscheduledReason.MINIMUM_SESSION_DURATION_CANNOT_FIT,
    );
  });

  it("enforces committed daily mission limits", () => {
    const result = planMissions(
      input({
        workWindows: [window(SUNDAY, 9, 12)],
        preferences: {
          maximumDailyMissionMinutes: 120,
          committedMissionMinutesByDate: { [SUNDAY]: 90 },
        },
        candidates: [candidate("over-cap", { estimatedDurationMinutes: 60 })],
      }),
    );

    expect(result.unscheduled[0]?.reason).toBe(
      UnscheduledReason.MAXIMUM_DAILY_MISSION_MINUTES_REACHED,
    );
  });

  it("places fixed missions first and reports fixed-time conflicts", () => {
    const fixed = (id: string, start: string, end: string) =>
      candidate(id, {
        schedule: {
          mode: SchedulingMode.FIXED_TIME,
          startsAt: start,
          endsAt: end,
        },
      });
    const result = planMissions(
      input({
        workWindows: [window(SUNDAY, 9, 12)],
        candidates: [
          fixed(
            "second",
            "2026-07-19T09:30:00.000Z",
            "2026-07-19T10:30:00.000Z",
          ),
          fixed(
            "first",
            "2026-07-19T09:00:00.000Z",
            "2026-07-19T10:00:00.000Z",
          ),
        ],
      }),
    );

    expect(result.scheduled.map((mission) => mission.occurrenceId)).toEqual(["first"]);
    expect(result.unscheduled).toMatchObject([
      { occurrenceId: "second", reason: UnscheduledReason.FIXED_TIME_CONFLICT },
    ]);
  });

  it("reserves a configured buffer between planned sessions", () => {
    const result = planMissions(
      input({
        workWindows: [
          {
            localDate: SUNDAY,
            startsAt: "2026-07-19T09:00:00.000Z",
            endsAt: "2026-07-19T11:10:00.000Z",
          },
        ],
        preferences: { missionBufferMinutes: 10 },
        candidates: [candidate("a"), candidate("b")],
      }),
    );

    expect(result.scheduled.map((mission) => mission.sessions[0]?.startsAt)).toEqual([
      "2026-07-19T09:00:00.000Z",
      "2026-07-19T10:10:00.000Z",
    ]);
  });

  it("rejects unsafe or ambiguous planner input", () => {
    expect(() =>
      planMissions(
        input({
          blockingPeriods: [
            {
              id: "bad-buffer",
              kind: BlockingPeriodKind.MEETING,
              startsAt: "2026-07-19T10:00:00.000Z",
              endsAt: "2026-07-19T11:00:00.000Z",
              bufferBeforeMinutes: -1,
            },
          ],
        }),
      ),
    ).toThrow("non-negative integer");

    expect(() =>
      planMissions(
        input({
          candidates: [candidate("duplicate"), candidate("duplicate")],
        }),
      ),
    ).toThrow("Duplicate occurrenceId");

    expect(() =>
      planMissions(
        input({
          candidates: [
            candidate("bad-weekdays", {
              schedule: {
                mode: SchedulingMode.SELECTED_WEEKDAYS,
                weekdays: [1, 1],
              },
            }),
          ],
        }),
      ),
    ).toThrow("unique Sunday-to-Thursday");
  });
});
