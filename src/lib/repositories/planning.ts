import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserId, UtcIsoDateTime } from "@/lib/domain/shared";
import type {
  PlanningBlocker,
  PlanningSettings,
} from "@/lib/planning/read-model";
import {
  BlockingPeriodKind,
  type BlockingPeriodKind as BlockingPeriodKindValue,
} from "@/lib/scheduling";

type ProfileRow = {
  timezone: string;
};

type PreferencesRow = {
  default_buffer_after_minutes: number;
  default_buffer_before_minutes: number;
  maximum_daily_work_minutes: number;
};

type CalendarItemRow = {
  ends_at: string;
  item_id: string;
  item_type: "meeting" | "mission" | "unavailable";
  starts_at: string;
  status: string;
};

const DEFAULT_SETTINGS: Omit<PlanningSettings, "timeZone"> = {
  bufferAfterMinutes: 0,
  bufferBeforeMinutes: 0,
  maximumDailyWorkMinutes: 540,
};

export async function getPlanningSettings(
  supabase: SupabaseClient,
  ownerId: UserId,
): Promise<PlanningSettings> {
  const [profileResult, preferencesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("timezone")
      .eq("id", ownerId)
      .single<ProfileRow>(),
    supabase
      .from("user_preferences")
      .select(
        "default_buffer_before_minutes,default_buffer_after_minutes,maximum_daily_work_minutes",
      )
      .eq("owner_id", ownerId)
      .maybeSingle<PreferencesRow>(),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }
  if (preferencesResult.error) {
    throw preferencesResult.error;
  }

  const preferences = preferencesResult.data;
  return {
    bufferAfterMinutes:
      preferences?.default_buffer_after_minutes ??
      DEFAULT_SETTINGS.bufferAfterMinutes,
    bufferBeforeMinutes:
      preferences?.default_buffer_before_minutes ??
      DEFAULT_SETTINGS.bufferBeforeMinutes,
    maximumDailyWorkMinutes:
      preferences?.maximum_daily_work_minutes ??
      DEFAULT_SETTINGS.maximumDailyWorkMinutes,
    timeZone: profileResult.data.timezone,
  };
}

export async function listPlanningBlockers(
  supabase: SupabaseClient,
  ownerId: UserId,
  startsAt: UtcIsoDateTime,
  endsBefore: UtcIsoDateTime,
): Promise<PlanningBlocker[]> {
  const { data, error } = await supabase
    .from("calendar_items")
    .select("item_id,item_type,starts_at,ends_at,status")
    .eq("owner_id", ownerId)
    .lt("starts_at", endsBefore)
    .gt("ends_at", startsAt)
    .order("starts_at", { ascending: true })
    .returns<CalendarItemRow[]>();

  if (error) {
    throw error;
  }

  return data
    .filter((row) => row.status !== "cancelled" && row.status !== "postponed")
    .map((row) => ({
      endsAt: row.ends_at,
      id: row.item_id,
      kind: mapBlockerKind(row.item_type),
      startsAt: row.starts_at,
    }));
}

function mapBlockerKind(
  itemType: CalendarItemRow["item_type"],
): BlockingPeriodKindValue {
  switch (itemType) {
    case "meeting":
      return BlockingPeriodKind.MEETING;
    case "mission":
      return BlockingPeriodKind.LOCKED_MISSION;
    case "unavailable":
      return BlockingPeriodKind.UNAVAILABLE;
  }
}
