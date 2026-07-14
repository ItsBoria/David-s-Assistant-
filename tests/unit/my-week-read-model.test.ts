import { describe, expect, it } from "vitest";

import { getWorkWeek } from "../../src/lib/dates/work-week";
import { MissionPriority, MissionStatus } from "../../src/lib/domain/mission";
import { DateOverrideKind } from "../../src/lib/domain/work-schedule";
import { buildMyWeekReadModel } from "../../src/lib/my-week/read-model";
import type { MissionInboxItem } from "../../src/lib/repositories/missions";
import type { WorkHoursDay } from "../../src/lib/repositories/work-hours";

const workHours: WorkHoursDay[] = [
  { enabled: true, endsAt: "17:00", startsAt: "09:00", weekday: 0 },
  { enabled: true, endsAt: "17:00", startsAt: "09:00", weekday: 1 },
  { enabled: true, endsAt: "17:00", startsAt: "09:00", weekday: 2 },
  { enabled: false, endsAt: "17:00", startsAt: "09:00", weekday: 3 },
  { enabled: true, endsAt: "15:00", startsAt: "09:00", weekday: 4 },
];

function mission(id: string, selectedDate: MissionInboxItem["selectedDate"]): MissionInboxItem {
  return {
    category: null,
    createdAt: "2026-07-14T00:00:00.000Z",
    description: null,
    estimatedDurationMinutes: 45,
    id,
    priority: MissionPriority.MEDIUM,
    selectedDate,
    status: MissionStatus.UNSCHEDULED,
    title: `Mission ${id}`,
    updatedAt: "2026-07-14T00:00:00.000Z",
  };
}

describe("my week read model", () => {
  it("groups selected-date missions onto Sunday-to-Thursday days", () => {
    const week = getWorkWeek("2026-07-14T08:00:00.000Z", "Asia/Jerusalem");
    const result = buildMyWeekReadModel({
      missions: [
        mission("a", "2026-07-12"),
        mission("b", "2026-07-14"),
        mission("c", "2026-07-14"),
      ],
      overrides: [],
      timeZone: "Asia/Jerusalem",
      week,
      workHours,
    });

    expect(result.startsOn).toBe("2026-07-12");
    expect(result.endsOn).toBe("2026-07-16");
    expect(result.days.map((day) => day.missions.length)).toEqual([
      1, 0, 2, 0, 0,
    ]);
    expect(result.days[3].workHours.enabled).toBe(false);
  });

  it("uses date-specific custom hours and day-off overrides before weekly hours", () => {
    const week = getWorkWeek("2026-07-14T08:00:00.000Z", "Asia/Jerusalem");
    const result = buildMyWeekReadModel({
      missions: [],
      overrides: [
        {
          endsAt: "13:30",
          id: "override-a",
          kind: DateOverrideKind.CUSTOM_HOURS,
          overrideDate: "2026-07-13",
          reason: "Short appointment day",
          startsAt: "10:00",
        },
        {
          endsAt: null,
          id: "override-b",
          kind: DateOverrideKind.DAY_OFF,
          overrideDate: "2026-07-14",
          reason: "Personal day",
          startsAt: null,
        },
      ],
      timeZone: "Asia/Jerusalem",
      week,
      workHours,
    });

    expect(result.days[1]).toMatchObject({
      overrideKind: DateOverrideKind.CUSTOM_HOURS,
      overrideReason: "Short appointment day",
      workHours: {
        enabled: true,
        endsAt: "13:30",
        startsAt: "10:00",
      },
    });
    expect(result.days[2]).toMatchObject({
      overrideKind: DateOverrideKind.DAY_OFF,
      overrideReason: "Personal day",
      workHours: { enabled: false },
    });
  });
});
