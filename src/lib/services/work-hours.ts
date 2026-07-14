import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserId } from "@/lib/domain/shared";
import {
  getActiveWorkHours,
  replaceActiveWorkHours,
  type WorkHoursSchedule,
} from "@/lib/repositories/work-hours";
import { saveWorkHoursSchema } from "@/lib/validation/work-hours";

type WorkHoursServiceContext = {
  ownerId: UserId;
  supabase: SupabaseClient;
};

export async function getWorkHoursSettings(
  context: WorkHoursServiceContext,
): Promise<WorkHoursSchedule> {
  return getActiveWorkHours(context.supabase, context.ownerId);
}

export async function saveWorkHoursSettings(
  context: WorkHoursServiceContext,
  input: unknown,
): Promise<WorkHoursSchedule> {
  const parsed = saveWorkHoursSchema.parse(input);

  return replaceActiveWorkHours(context.supabase, context.ownerId, parsed.days);
}
