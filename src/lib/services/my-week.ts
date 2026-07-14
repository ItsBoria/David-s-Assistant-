import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getWorkWeek } from "@/lib/dates/work-week";
import type { UserId } from "@/lib/domain/shared";
import { buildMyWeekReadModel, type MyWeekReadModel } from "@/lib/my-week/read-model";
import {
  buildMyWeekPlanPreview,
  type MyWeekPlanPreview,
} from "@/lib/planning/read-model";
import { listDateScheduleOverridesInRange } from "@/lib/repositories/date-overrides";
import { listSelectedDateMissionsInRange } from "@/lib/repositories/missions";
import {
  getPlanningSettings,
  listPlanningBlockers,
} from "@/lib/repositories/planning";
import { getActiveWorkHours } from "@/lib/repositories/work-hours";

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
  return (await getMyWeekWorkspace({ now, ownerId, supabase })).week;
}

export type MyWeekWorkspace = {
  planPreview: MyWeekPlanPreview;
  week: MyWeekReadModel;
};

export async function getMyWeekWorkspace({
  now = new Date(),
  ownerId,
  supabase,
}: MyWeekServiceContext): Promise<MyWeekWorkspace> {
  const settings = await getPlanningSettings(supabase, ownerId);
  const workWeek = getWorkWeek(now, settings.timeZone);
  const [workHours, missions, overrides, blockers] = await Promise.all([
    getActiveWorkHours(supabase, ownerId),
    listSelectedDateMissionsInRange(
      supabase,
      ownerId,
      workWeek[0].localDate,
      workWeek[4].localDate,
    ),
    listDateScheduleOverridesInRange(
      supabase,
      ownerId,
      workWeek[0].localDate,
      workWeek[4].localDate,
    ),
    listPlanningBlockers(
      supabase,
      ownerId,
      workWeek[0].startsAt.toISOString(),
      workWeek[4].endsBefore.toISOString(),
    ),
  ]);

  const week = buildMyWeekReadModel({
    missions,
    overrides,
    timeZone: settings.timeZone,
    week: workWeek,
    workHours: workHours.days,
  });

  return {
    planPreview: buildMyWeekPlanPreview({ blockers, now, settings, week }),
    week,
  };
}
