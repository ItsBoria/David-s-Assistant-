import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { WORK_WEEKDAYS, type LocalTime, type UserId, type WorkWeekday } from "@/lib/domain/shared";

export type WorkHoursDay = {
  enabled: boolean;
  startsAt: LocalTime;
  endsAt: LocalTime;
  weekday: WorkWeekday;
};

export type WorkHoursSchedule = {
  days: WorkHoursDay[];
  scheduleId: string | null;
};

type WeeklyWorkScheduleRow = {
  id: string;
};

type WorkSchedulePeriodRow = {
  ends_at: string;
  starts_at: string;
  weekday: number;
};

const DEFAULT_START = "09:00" as LocalTime;
const DEFAULT_END = "17:00" as LocalTime;

function normalizeDbTime(value: string): LocalTime {
  return value.slice(0, 5) as LocalTime;
}

function defaultDays(): WorkHoursDay[] {
  return WORK_WEEKDAYS.map((weekday) => ({
    enabled: false,
    endsAt: DEFAULT_END,
    startsAt: DEFAULT_START,
    weekday,
  }));
}

function mapScheduleRows(
  scheduleId: string | null,
  rows: WorkSchedulePeriodRow[],
): WorkHoursSchedule {
  const byWeekday = new Map<WorkWeekday, WorkSchedulePeriodRow>();

  for (const row of rows) {
    if ((WORK_WEEKDAYS as readonly number[]).includes(row.weekday)) {
      byWeekday.set(row.weekday as WorkWeekday, row);
    }
  }

  return {
    days: defaultDays().map((day) => {
      const row = byWeekday.get(day.weekday);

      if (!row) {
        return day;
      }

      return {
        enabled: true,
        endsAt: normalizeDbTime(row.ends_at),
        startsAt: normalizeDbTime(row.starts_at),
        weekday: day.weekday,
      };
    }),
    scheduleId,
  };
}

export async function getActiveWorkHours(
  supabase: SupabaseClient,
  ownerId: UserId,
): Promise<WorkHoursSchedule> {
  const { data: schedule, error: scheduleError } = await supabase
    .from("weekly_work_schedules")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle<WeeklyWorkScheduleRow>();

  if (scheduleError) {
    throw scheduleError;
  }

  if (!schedule) {
    return mapScheduleRows(null, []);
  }

  const { data: periods, error: periodsError } = await supabase
    .from("work_schedule_periods")
    .select("weekday,starts_at,ends_at")
    .eq("owner_id", ownerId)
    .eq("schedule_id", schedule.id)
    .eq("period_kind", "work")
    .in("weekday", [...WORK_WEEKDAYS])
    .order("weekday", { ascending: true })
    .order("starts_at", { ascending: true })
    .returns<WorkSchedulePeriodRow[]>();

  if (periodsError) {
    throw periodsError;
  }

  return mapScheduleRows(schedule.id, periods);
}

async function ensureActiveSchedule(
  supabase: SupabaseClient,
  ownerId: UserId,
): Promise<string> {
  const active = await getActiveWorkHours(supabase, ownerId);

  if (active.scheduleId) {
    return active.scheduleId;
  }

  const { data, error } = await supabase
    .from("weekly_work_schedules")
    .insert({
      is_active: true,
      name: "Default schedule",
      owner_id: ownerId,
    })
    .select("id")
    .single<WeeklyWorkScheduleRow>();

  if (error) {
    throw error;
  }

  return data.id;
}

export async function replaceActiveWorkHours(
  supabase: SupabaseClient,
  ownerId: UserId,
  days: WorkHoursDay[],
): Promise<WorkHoursSchedule> {
  const scheduleId = await ensureActiveSchedule(supabase, ownerId);

  const { error: deleteError } = await supabase
    .from("work_schedule_periods")
    .delete()
    .eq("owner_id", ownerId)
    .eq("schedule_id", scheduleId)
    .eq("period_kind", "work")
    .in("weekday", [...WORK_WEEKDAYS]);

  if (deleteError) {
    throw deleteError;
  }

  const rows = days
    .filter((day) => day.enabled)
    .map((day) => ({
      ends_at: day.endsAt,
      owner_id: ownerId,
      period_kind: "work",
      schedule_id: scheduleId,
      starts_at: day.startsAt,
      weekday: day.weekday,
    }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("work_schedule_periods")
      .insert(rows);

    if (insertError) {
      throw insertError;
    }
  }

  return getActiveWorkHours(supabase, ownerId);
}
