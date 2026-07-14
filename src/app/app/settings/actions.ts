"use server";

import { revalidatePath } from "next/cache";

import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import { saveWorkHoursSettings } from "@/lib/services/work-hours";
import { createClient } from "@/lib/supabase/server";
import { saveWorkHoursSchema } from "@/lib/validation/work-hours";

export type SaveWorkHoursActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveWorkHoursAction(
  input: unknown,
): Promise<SaveWorkHoursActionResult> {
  const parsed = saveWorkHoursSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: t(DEFAULT_LOCALE, "settings.workHours.validationSummary"),
      ok: false,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const ownerId = data?.claims?.sub;

    if (error || typeof ownerId !== "string") {
      return {
        message: t(DEFAULT_LOCALE, "settings.workHours.authRequired"),
        ok: false,
      };
    }

    await saveWorkHoursSettings({ ownerId, supabase }, parsed.data);
    revalidatePath("/app/settings");

    return {
      message: t(DEFAULT_LOCALE, "settings.workHours.saved"),
      ok: true,
    };
  } catch (error) {
    console.error("settings.workHours.save.failed", {
      message: error instanceof Error ? error.message : undefined,
    });

    return {
      message: t(DEFAULT_LOCALE, "settings.workHours.unavailable"),
      ok: false,
    };
  }
}
