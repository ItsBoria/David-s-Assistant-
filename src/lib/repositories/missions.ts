import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MissionPriority,
  MissionStatus,
  SchedulingMode,
  type MissionPriority as MissionPriorityValue,
} from "@/lib/domain/mission";
import type { EntityId, LocalDate, UserId } from "@/lib/domain/shared";

export type MissionInboxItem = {
  id: EntityId;
  title: string;
  description: string | null;
  priority: MissionPriorityValue;
  status: typeof MissionStatus.UNSCHEDULED;
  estimatedDurationMinutes: number;
  selectedDate: LocalDate;
  category: string | null;
  createdAt: string;
  updatedAt: string;
};

type MissionInboxRow = {
  id: string;
  title: string;
  description: string | null;
  priority: MissionPriorityValue;
  status: typeof MissionStatus.UNSCHEDULED;
  estimated_duration_minutes: number;
  selected_date: string;
  category: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSelectedDateMissionRecord = {
  ownerId: UserId;
  title: string;
  description: string | null;
  priority: MissionPriorityValue;
  estimatedDurationMinutes: number;
  selectedDate: LocalDate;
  category: string | null;
};

export type UpdateSelectedDateMissionRecord = CreateSelectedDateMissionRecord & {
  id: EntityId;
};

function mapInboxRow(row: MissionInboxRow): MissionInboxItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    estimatedDurationMinutes: row.estimated_duration_minutes,
    selectedDate: row.selected_date as LocalDate,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createSelectedDateMission(
  supabase: SupabaseClient,
  mission: CreateSelectedDateMissionRecord,
): Promise<MissionInboxItem> {
  const { data, error } = await supabase
    .from("missions")
    .insert({
      owner_id: mission.ownerId,
      title: mission.title,
      description: mission.description,
      priority: mission.priority,
      status: MissionStatus.UNSCHEDULED,
      scheduling_mode: SchedulingMode.SELECTED_DATE,
      estimated_duration_minutes: mission.estimatedDurationMinutes,
      selected_date: mission.selectedDate,
      category: mission.category,
      source_channel: "web",
    })
    .select(
      "id,title,description,priority,status,estimated_duration_minutes,selected_date,category,created_at,updated_at",
    )
    .single<MissionInboxRow>();

  if (error) {
    throw error;
  }

  return mapInboxRow(data);
}

export async function updateSelectedDateMission(
  supabase: SupabaseClient,
  mission: UpdateSelectedDateMissionRecord,
): Promise<MissionInboxItem> {
  const { data, error } = await supabase
    .from("missions")
    .update({
      title: mission.title,
      description: mission.description,
      priority: mission.priority,
      estimated_duration_minutes: mission.estimatedDurationMinutes,
      selected_date: mission.selectedDate,
      category: mission.category,
    })
    .eq("id", mission.id)
    .eq("owner_id", mission.ownerId)
    .eq("status", MissionStatus.UNSCHEDULED)
    .eq("scheduling_mode", SchedulingMode.SELECTED_DATE)
    .select(
      "id,title,description,priority,status,estimated_duration_minutes,selected_date,category,created_at,updated_at",
    )
    .single<MissionInboxRow>();

  if (error) {
    throw error;
  }

  return mapInboxRow(data);
}

export async function cancelSelectedDateMission(
  supabase: SupabaseClient,
  ownerId: UserId,
  missionId: EntityId,
): Promise<void> {
  const { data, error } = await supabase
    .from("missions")
    .update({ status: MissionStatus.CANCELLED })
    .eq("id", missionId)
    .eq("owner_id", ownerId)
    .eq("status", MissionStatus.UNSCHEDULED)
    .eq("scheduling_mode", SchedulingMode.SELECTED_DATE)
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Mission was not found or is no longer editable.");
  }
}

export async function listMissionInboxItems(
  supabase: SupabaseClient,
  ownerId: UserId,
): Promise<MissionInboxItem[]> {
  const { data, error } = await supabase
    .from("missions")
    .select(
      "id,title,description,priority,status,estimated_duration_minutes,selected_date,category,created_at,updated_at",
    )
    .eq("owner_id", ownerId)
    .eq("status", MissionStatus.UNSCHEDULED)
    .eq("scheduling_mode", SchedulingMode.SELECTED_DATE)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<MissionInboxRow[]>();

  if (error) {
    throw error;
  }

  return data.map(mapInboxRow);
}

export async function listSelectedDateMissionsInRange(
  supabase: SupabaseClient,
  ownerId: UserId,
  startsOn: LocalDate,
  endsOn: LocalDate,
): Promise<MissionInboxItem[]> {
  const { data, error } = await supabase
    .from("missions")
    .select(
      "id,title,description,priority,status,estimated_duration_minutes,selected_date,category,created_at,updated_at",
    )
    .eq("owner_id", ownerId)
    .eq("status", MissionStatus.UNSCHEDULED)
    .eq("scheduling_mode", SchedulingMode.SELECTED_DATE)
    .gte("selected_date", startsOn)
    .lte("selected_date", endsOn)
    .order("selected_date", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<MissionInboxRow[]>();

  if (error) {
    throw error;
  }

  return data.map(mapInboxRow);
}

export const missionPriorityOrder = [
  MissionPriority.URGENT,
  MissionPriority.HIGH,
  MissionPriority.MEDIUM,
  MissionPriority.LOW,
] as const;
