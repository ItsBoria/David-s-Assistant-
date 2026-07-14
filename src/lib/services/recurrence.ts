import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateMissionOccurrenceRows } from "@/lib/repositories/recurrence";
import {
  generateMissionOccurrencesSchema,
  type GeneratedMissionOccurrencesResult,
} from "@/lib/validation/recurrence";

export async function generateMissionOccurrences(
  supabase: SupabaseClient,
  input: unknown,
): Promise<GeneratedMissionOccurrencesResult> {
  const parsed = generateMissionOccurrencesSchema.parse(input);
  return generateMissionOccurrenceRows(supabase, parsed);
}
