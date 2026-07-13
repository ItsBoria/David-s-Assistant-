import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserId } from "@/lib/domain/shared";
import {
  createSelectedDateMission,
  listMissionInboxItems,
  type MissionInboxItem,
} from "@/lib/repositories/missions";
import {
  createMissionSchema,
} from "@/lib/validation/mission";

type MissionServiceContext = {
  supabase: SupabaseClient;
  ownerId: UserId;
};

export async function createMissionForInbox(
  context: MissionServiceContext,
  input: unknown,
): Promise<MissionInboxItem> {
  const mission = createMissionSchema.parse(input);

  return createSelectedDateMission(context.supabase, {
    ownerId: context.ownerId,
    title: mission.title,
    description: mission.description,
    priority: mission.priority,
    estimatedDurationMinutes: mission.estimatedDurationMinutes,
    selectedDate: mission.selectedDate,
    category: mission.category,
  });
}

export async function getMissionInbox(
  context: MissionServiceContext,
): Promise<MissionInboxItem[]> {
  return listMissionInboxItems(context.supabase, context.ownerId);
}
