import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getWorkWeek } from "@/lib/dates/work-week";
import type { UserId } from "@/lib/domain/shared";
import { buildMyWeekReadModel, type MyWeekReadModel } from "@/lib/my-week/read-model";
import { listSelectedDateMissionsInRange } from "@/lib/repositories/missions";
import { getActiveWorkHours } from "@/lib/repositories/work-hours";

const DEFAULT_TIME_ZONE = "Asia/Jerusalem";

type MyWeekServiceContext = {
  now?: Date;
  ownerId: UserId;
  supabase: SupabaseClient;
};

export async function getMyWeekReadModel({
  now = new Date(),
  ownerId,
  supabase,
}: MyWeekServiceContext): Promise<MyWeekReadModel> {
  const timeZone = DEFAULT_TIME_ZONE;
  const week = getWorkWeek(now, timeZone);
  const [workHours, missions] = await Promise.all([
    getActiveWorkHours(supabase, ownerId),
    listSelectedDateMissionsInRange(
      supabase,
      ownerId,
      week[0].localDate,
      week[4].localDate,
    ),
  ]);

  return buildMyWeekReadModel({
    missions,
    timeZone,
    week,
    workHours: workHours.days,
  });
}
