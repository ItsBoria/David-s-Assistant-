import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { EntityId, LocalDate, LocalTime, UserId } from "@/lib/domain/shared";
import type { DateOverrideKind as DateOverrideKindValue } from "@/lib/domain/work-schedule";

export type DateScheduleOverrideItem = {
  endsAt: LocalTime | null;
  id: EntityId;
  kind: DateOverrideKindValue;
  overrideDate: LocalDate;
  reason: string | null;
  startsAt: LocalTime | null;
};

type DateOverridePeriodRow = {
  ends_at: string;
  period_kind: "work" | "break";
  starts_at: string;
};

type DateOverrideRow = {
  date_schedule_override_periods: DateOverridePeriodRow[];
  id: string;
  override_date: string;
  override_kind: DateOverrideKindValue;
  reason: string | null;
};

type SaveDateOverrideRecord = {
  endsAt: LocalTime | null;
  kind: DateOverrideKindValue;
  overrideDate: LocalDate;
  reason: string | null;
  startsAt: LocalTime | null;
};

function normalizeDbTime(value: string): LocalTime {
  return value.slice(0, 5) as LocalTime;
}

function mapOverrideRow(row: DateOverrideRow): DateScheduleOverrideItem {
  const workPeriod = row.date_schedule_override_periods.find(
    (period) => period.period_kind === "work",
  );

  return {
    endsAt: workPeriod ? normalizeDbTime(workPeriod.ends_at) : null,
    id: row.id,
    kind: row.override_kind,
    overrideDate: row.override_date as LocalDate,
    reason: row.reason,
    startsAt: workPeriod ? normalizeDbTime(workPeriod.starts_at) : null,
  };
}

function overrideSelect() {
  return "id,override_date,override_kind,reason,date_schedule_override_periods(starts_at,ends_at,period_kind)";
}

export async function listDateScheduleOverrides(
  supabase: SupabaseClient,
  ownerId: UserId,
  startsOn: LocalDate,
): Promise<DateScheduleOverrideItem[]> {
  const { data, error } = await supabase
    .from("date_schedule_overrides")
    .select(overrideSelect())
    .eq("owner_id", ownerId)
    .gte("override_date", startsOn)
    .order("override_date", { ascending: true })
    .limit(50)
    .returns<DateOverrideRow[]>();

  if (error) {
    throw error;
  }

  return data.map(mapOverrideRow);
}

export async function listDateScheduleOverridesInRange(
  supabase: SupabaseClient,
  ownerId: UserId,
  startsOn: LocalDate,
  endsOn: LocalDate,
): Promise<DateScheduleOverrideItem[]> {
  const { data, error } = await supabase
    .from("date_schedule_overrides")
    .select(overrideSelect())
    .eq("owner_id", ownerId)
    .gte("override_date", startsOn)
    .lte("override_date", endsOn)
    .order("override_date", { ascending: true })
    .returns<DateOverrideRow[]>();

  if (error) {
    throw error;
  }

  return data.map(mapOverrideRow);
}

export async function saveDateScheduleOverride(
  supabase: SupabaseClient,
  override: SaveDateOverrideRecord,
): Promise<void> {
  const { error } = await supabase.rpc("save_date_schedule_override", {
    p_ends_at: override.endsAt,
    p_override_date: override.overrideDate,
    p_override_kind: override.kind,
    p_reason: override.reason,
    p_starts_at: override.startsAt,
  });

  if (error) {
    throw error;
  }
}

export async function removeDateScheduleOverride(
  supabase: SupabaseClient,
  ownerId: UserId,
  overrideDate: LocalDate,
): Promise<void> {
  const { data, error } = await supabase
    .from("date_schedule_overrides")
    .delete()
    .eq("owner_id", ownerId)
    .eq("override_date", overrideDate)
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Date override was not found.");
  }
}
