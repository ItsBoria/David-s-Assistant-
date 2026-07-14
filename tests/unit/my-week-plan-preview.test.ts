import { describe, expect, it } from "vitest";

import { getWorkWeek } from "../../src/lib/dates";
import { MissionPriority, MissionStatus } from "../../src/lib/domain/mission";
import type { MyWeekReadModel } from "../../src/lib/my-week/read-model";
import { buildMyWeekReadModel } from "../../src/lib/my-week/read-model";
import { buildMyWeekPlanPreview } from "../../src/lib/planning/read-model";
import type { PlanningSettings } from "../../src/lib/planning/read-model";
import type { MissionInboxItem } from "../../src/lib/repositories/missions";
import type { WorkHoursDay } from "../../src/lib/repositories/work-hours";
import { BlockingPeriodKind, UnscheduledReason } from "../../src/lib/scheduling";

const settings: PlanningSettings = {
  bufferAfterMinutes: 15,
  bufferBeforeMinutes: 15,
  maximumDailyWorkMinutes: 540,
  timeZone: "Asia/Jerusalem",
};

const workHours: WorkHoursDay[] = [
  { enabled: true, endsAt: "12:00", startsAt: "09:00", weekday: 0 },
  { enabled: false, endsAt: "17:00", startsAt: "09:00", weekday: 1 },
  { enabled: false, endsAt: "17:00", startsAt: "09:00", weekday: 2 },
  { enabled: false, endsAt: "17:00", startsAt: "09:00", weekday: 3 },
  { enabled: false, endsAt: "17:00", startsAt: "09:00", weekday: 4 },
];

function mission(
  id: string,
  estimatedDurationMinutes = 60,
): MissionInboxItem {
  return {
    category: null,
    createdAt: "2026-07-18T08:00:00.000Z",
    description: null,
    estimatedDurationMinutes,
    id,
    priority: MissionPriority.HIGH,
    selectedDate: "2026-07-19",
    status: MissionStatus.UNSCHEDULED,
    title: `Mission ${id}`,
    updatedAt: "2026-07-18T08:00:00.000Z",
  };
}

function week(missions: MissionInboxItem[]): MyWeekReadModel {
  return buildMyWeekReadModel({
    missions,
    overrides: [],
    timeZone: settings.timeZone,
    week: getWorkWeek("2026-07-19T05:00:00.000Z", settings.timeZone),
    workHours,
  });
}

describe("My Week plan preview", () => {
  it("uses effective local work hours and buffered calendar blockers", () => {
    const result = buildMyWeekPlanPreview({
      blockers: [
        {
          domainId: "meeting-1",
          endsAt: "2026-07-19T07:00:00.000Z",
          id: "meeting-1",
          kind: BlockingPeriodKind.MEETING,
          startsAt: "2026-07-19T06:30:00.000Z",
          status: "planned",
          title: "Client meeting",
        },
      ],
      now: new Date("2026-07-19T05:00:00.000Z"),
      settings,
      week: week([mission("one")]),
    });

    expect(result.scheduled).toMatchObject([
      {
        endsAt: "2026-07-19T08:15:00.000Z",
        localDate: "2026-07-19",
        missionId: "one",
        startsAt: "2026-07-19T07:15:00.000Z",
        title: "Mission one",
      },
    ]);
    expect(result.unscheduled).toEqual([]);
  });

  it("never proposes a session in elapsed work time", () => {
    const result = buildMyWeekPlanPreview({
      blockers: [],
      now: new Date("2026-07-19T06:20:00.000Z"),
      settings: { ...settings, bufferAfterMinutes: 0, bufferBeforeMinutes: 0 },
      week: week([mission("current")]),
    });

    expect(result.scheduled[0]?.startsAt).toBe("2026-07-19T06:20:00.000Z");
  });

  it("rounds an in-progress work window to a stable five-minute boundary", () => {
    const first = buildMyWeekPlanPreview({
      blockers: [],
      now: new Date("2026-07-19T06:20:14.000Z"),
      settings: { ...settings, bufferAfterMinutes: 0, bufferBeforeMinutes: 0 },
      week: week([mission("stable")]),
    });
    const second = buildMyWeekPlanPreview({
      blockers: [],
      now: new Date("2026-07-19T06:24:59.000Z"),
      settings: { ...settings, bufferAfterMinutes: 0, bufferBeforeMinutes: 0 },
      week: week([mission("stable")]),
    });

    expect(first.scheduled[0]?.startsAt).toBe("2026-07-19T06:25:00.000Z");
    expect(second.scheduled).toEqual(first.scheduled);
  });

  it("surfaces the daily limit instead of silently dropping a mission", () => {
    const result = buildMyWeekPlanPreview({
      blockers: [],
      now: new Date("2026-07-19T05:00:00.000Z"),
      settings: { ...settings, maximumDailyWorkMinutes: 30 },
      week: week([mission("too-much", 60)]),
    });

    expect(result.unscheduled).toMatchObject([
      {
        missionId: "too-much",
        reason: UnscheduledReason.MAXIMUM_DAILY_MISSION_MINUTES_REACHED,
      },
    ]);
  });

  it("counts existing meetings and planned sessions toward the daily cap", () => {
    const result = buildMyWeekPlanPreview({
      blockers: [
        {
          domainId: "meeting-1",
          endsAt: "2026-07-19T07:00:00.000Z",
          id: "meeting-1",
          kind: BlockingPeriodKind.MEETING,
          startsAt: "2026-07-19T06:00:00.000Z",
          status: "planned",
          title: "Client meeting",
        },
      ],
      now: new Date("2026-07-19T05:00:00.000Z"),
      settings: {
        ...settings,
        bufferAfterMinutes: 0,
        bufferBeforeMinutes: 0,
        maximumDailyWorkMinutes: 90,
      },
      week: week([mission("after-meeting", 60)]),
    });

    expect(result.unscheduled[0]?.reason).toBe(
      UnscheduledReason.MAXIMUM_DAILY_MISSION_MINUTES_REACHED,
    );
  });

  it("returns already persisted mission sessions for the saved schedule", () => {
    const result = buildMyWeekPlanPreview({
      blockers: [
        {
          domainId: "mission-saved",
          endsAt: "2026-07-19T07:00:00.000Z",
          id: "session-saved",
          kind: BlockingPeriodKind.LOCKED_MISSION,
          startsAt: "2026-07-19T06:00:00.000Z",
          status: "planned",
          title: "Saved mission",
        },
      ],
      now: new Date("2026-07-19T05:00:00.000Z"),
      settings,
      week: week([]),
    });

    expect(result.savedSessions).toEqual([
      {
        endsAt: "2026-07-19T07:00:00.000Z",
        id: "session-saved",
        localDate: "2026-07-19",
        missionId: "mission-saved",
        startsAt: "2026-07-19T06:00:00.000Z",
        title: "Saved mission",
      },
    ]);
  });
});
