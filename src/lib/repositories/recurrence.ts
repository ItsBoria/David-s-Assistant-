import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  generatedMissionOccurrencesResultSchema,
  type GenerateMissionOccurrencesInput,
  type GeneratedMissionOccurrencesResult,
} from "@/lib/validation/recurrence";

export async function generateMissionOccurrenceRows(
  supabase: SupabaseClient,
  input: GenerateMissionOccurrencesInput,
): Promise<GeneratedMissionOccurrencesResult> {
  const { data, error } = await supabase.rpc(
    "generate_mission_recurrence_occurrences",
    {
      p_mission_id: input.missionId,
      p_through_date: input.throughDate,
    },
  );

  if (error) {
    throw error;
  }

  return generatedMissionOccurrencesResultSchema.parse(data);
}
