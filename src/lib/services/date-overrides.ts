import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { toLocalDate } from "@/lib/dates/work-week";
import type { LocalDate, UserId } from "@/lib/domain/shared";
import { DateOverrideKind } from "@/lib/domain/work-schedule";
import {
  listDateScheduleOverrides,
  listDateScheduleOverridesInRange,
  removeDateScheduleOverride,
  saveDateScheduleOverride,
  type DateScheduleOverrideItem,
} from "@/lib/repositories/date-overrides";
import {
  removeDateOverrideSchema,
  saveDateOverrideSchema,
} from "@/lib/validation/work-hours";

type DateOverrideServiceContext = {
  ownerId: UserId;
  supabase: SupabaseClient;
};

const DEFAULT_TIME_ZONE = "Asia/Jerusalem";

export async function getDateOverrideSettings(
  context: DateOverrideServiceContext,
): Promise<DateScheduleOverrideItem[]> {
  return listDateScheduleOverrides(
    context.supabase,
    context.ownerId,
    toLocalDate(new Date(), DEFAULT_TIME_ZONE),
  );
}

export async function getDateOverridesForRange(
  context: DateOverrideServiceContext,
  startsOn: LocalDate,
  endsOn: LocalDate,
): Promise<DateScheduleOverrideItem[]> {
  return listDateScheduleOverridesInRange(
    context.supabase,
    context.ownerId,
    startsOn,
    endsOn,
  );
}

export async function saveDateOverrideSettings(
  context: DateOverrideServiceContext,
  input: unknown,
): Promise<void> {
  const override = saveDateOverrideSchema.parse(input);

  await saveDateScheduleOverride(context.supabase, {
    endsAt:
      override.kind === DateOverrideKind.CUSTOM_HOURS
        ? override.endsAt
        : null,
    kind: override.kind,
    overrideDate: override.overrideDate,
    reason: override.reason,
    startsAt:
      override.kind === DateOverrideKind.CUSTOM_HOURS
        ? override.startsAt
        : null,
  });
}

export async function removeDateOverrideSettings(
  context: DateOverrideServiceContext,
  input: unknown,
): Promise<void> {
  const override = removeDateOverrideSchema.parse(input);

  await removeDateScheduleOverride(
    context.supabase,
    context.ownerId,
    override.overrideDate,
  );
}
