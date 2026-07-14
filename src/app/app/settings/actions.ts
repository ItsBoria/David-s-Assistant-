"use server";

import { revalidatePath } from "next/cache";

import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import {
  removeDateOverrideSettings,
  saveDateOverrideSettings,
} from "@/lib/services/date-overrides";
import { saveWorkHoursSettings } from "@/lib/services/work-hours";
import { createClient } from "@/lib/supabase/server";
import {
  removeDateOverrideSchema,
  saveDateOverrideSchema,
  saveWorkHoursSchema,
} from "@/lib/validation/work-hours";

export type SaveWorkHoursActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type DateOverrideActionResult = SaveWorkHoursActionResult;

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

export async function saveDateOverrideAction(
  input: unknown,
): Promise<DateOverrideActionResult> {
  const parsed = saveDateOverrideSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: t(DEFAULT_LOCALE, "settings.dateOverrides.validationSummary"),
      ok: false,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const ownerId = data?.claims?.sub;

    if (error || typeof ownerId !== "string") {
      return {
        message: t(DEFAULT_LOCALE, "settings.dateOverrides.authRequired"),
        ok: false,
      };
    }

    await saveDateOverrideSettings({ ownerId, supabase }, parsed.data);
    revalidatePath("/app");
    revalidatePath("/app/settings");

    return {
      message: t(DEFAULT_LOCALE, "settings.dateOverrides.saved"),
      ok: true,
    };
  } catch (error) {
    console.error("settings.dateOverrides.save.failed", {
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : undefined,
    });

    return {
      message: t(DEFAULT_LOCALE, "settings.dateOverrides.unavailable"),
      ok: false,
    };
  }
}

export async function removeDateOverrideAction(
  input: unknown,
): Promise<DateOverrideActionResult> {
  const parsed = removeDateOverrideSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: t(DEFAULT_LOCALE, "settings.dateOverrides.removeUnavailable"),
      ok: false,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const ownerId = data?.claims?.sub;

    if (error || typeof ownerId !== "string") {
      return {
        message: t(DEFAULT_LOCALE, "settings.dateOverrides.authRequired"),
        ok: false,
      };
    }

    await removeDateOverrideSettings({ ownerId, supabase }, parsed.data);
    revalidatePath("/app");
    revalidatePath("/app/settings");

    return {
      message: t(DEFAULT_LOCALE, "settings.dateOverrides.removed"),
      ok: true,
    };
  } catch (error) {
    console.error("settings.dateOverrides.remove.failed", {
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : undefined,
    });

    return {
      message: t(DEFAULT_LOCALE, "settings.dateOverrides.removeUnavailable"),
      ok: false,
    };
  }
}
