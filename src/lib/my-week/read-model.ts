import type { LocalDate, WorkWeekday } from "@/lib/domain/shared";
import type { WorkWeek } from "@/lib/dates/work-week";
import type { MissionInboxItem } from "@/lib/repositories/missions";
import type { WorkHoursDay } from "@/lib/repositories/work-hours";

export type MyWeekDay = {
  localDate: LocalDate;
  missions: MissionInboxItem[];
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
  timeZone,
  week,
  workHours,
}: {
  missions: MissionInboxItem[];
  timeZone: string;
  week: WorkWeek;
  workHours: WorkHoursDay[];
}): MyWeekReadModel {
  const workHoursByWeekday = new Map(
    workHours.map((day) => [day.weekday, day]),
  );
  const missionsByDate = new Map<LocalDate, MissionInboxItem[]>();

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

    return {
      localDate: day.localDate,
      missions: missionsByDate.get(day.localDate) ?? [],
      weekday: day.weekday,
      workHours: workHoursForDay,
    };
  });

  return {
    days,
    endsOn: days[days.length - 1].localDate,
    startsOn: days[0].localDate,
    timeZone,
  };
}
