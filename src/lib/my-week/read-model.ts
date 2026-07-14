import type { LocalDate, WorkWeekday } from "@/lib/domain/shared";
import {
  DateOverrideKind,
  type DateOverrideKind as DateOverrideKindValue,
} from "@/lib/domain/work-schedule";
import type { WorkWeek } from "@/lib/dates/work-week";
import type { DateScheduleOverrideItem } from "@/lib/repositories/date-overrides";
import type { MissionInboxItem } from "@/lib/repositories/missions";
import type { WorkHoursDay } from "@/lib/repositories/work-hours";

export type MyWeekDay = {
  localDate: LocalDate;
  missions: MissionInboxItem[];
  overrideKind: DateOverrideKindValue | null;
  overrideReason: string | null;
  workHours: WorkHoursDay;
  weekday: WorkWeekday;
};

export type MyWeekReadModel = {
  days: MyWeekDay[];
  endsOn: LocalDate;
  startsOn: LocalDate;
  timeZone: string;
};

export function buildMyWeekReadModel({
  missions,
  overrides,
  timeZone,
  week,
  workHours,
}: {
  missions: MissionInboxItem[];
  overrides: DateScheduleOverrideItem[];
  timeZone: string;
  week: WorkWeek;
  workHours: WorkHoursDay[];
}): MyWeekReadModel {
  const workHoursByWeekday = new Map(
    workHours.map((day) => [day.weekday, day]),
  );
  const missionsByDate = new Map<LocalDate, MissionInboxItem[]>();
  const overridesByDate = new Map(
    overrides.map((override) => [override.overrideDate, override]),
  );

  for (const mission of missions) {
    const dayMissions = missionsByDate.get(mission.selectedDate) ?? [];
    dayMissions.push(mission);
    missionsByDate.set(mission.selectedDate, dayMissions);
  }

  const days = week.map((day) => {
    const workHoursForDay = workHoursByWeekday.get(day.weekday);

    if (!workHoursForDay) {
      throw new Error(`Missing work hours for weekday ${day.weekday}`);
    }

    const override = overridesByDate.get(day.localDate);
    let effectiveWorkHours = workHoursForDay;

    if (override) {
      if (
        override.kind === DateOverrideKind.CUSTOM_HOURS &&
        override.startsAt !== null &&
        override.endsAt !== null
      ) {
        effectiveWorkHours = {
          enabled: true,
          endsAt: override.endsAt,
          startsAt: override.startsAt,
          weekday: day.weekday,
        };
      } else {
        effectiveWorkHours = {
          enabled: false,
          endsAt: workHoursForDay.endsAt,
          startsAt: workHoursForDay.startsAt,
          weekday: day.weekday,
        };
      }
    }

    return {
      localDate: day.localDate,
      missions: missionsByDate.get(day.localDate) ?? [],
      overrideKind: override?.kind ?? null,
      overrideReason: override?.reason ?? null,
      weekday: day.weekday,
      workHours: effectiveWorkHours,
    };
  });

  return {
    days,
    endsOn: days[days.length - 1].localDate,
    startsOn: days[0].localDate,
    timeZone,
  };
}
