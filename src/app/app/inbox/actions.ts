"use server";

import { revalidatePath } from "next/cache";

import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import { createMissionForInbox } from "@/lib/services/missions";
import { createClient } from "@/lib/supabase/server";
import { createMissionSchema } from "@/lib/validation/mission";

export type CreateMissionActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function missionActionErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { name: "unknown" };
  }

  const record = error as Record<string, unknown>;

  return {
    code: typeof record.code === "string" ? record.code : undefined,
    details: typeof record.details === "string" ? record.details : undefined,
    hint: typeof record.hint === "string" ? record.hint : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    name: typeof record.name === "string" ? record.name : undefined,
  };
}

export async function createMissionAction(
  input: unknown,
): Promise<CreateMissionActionResult> {
  const parsed = createMissionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: t(DEFAULT_LOCALE, "mission.inbox.validationSummary"),
      ok: false,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const ownerId = data?.claims?.sub;

    if (error || typeof ownerId !== "string") {
      return {
        message: t(DEFAULT_LOCALE, "mission.inbox.authRequired"),
        ok: false,
      };
    }

    await createMissionForInbox({
      ownerId,
      supabase,
    }, parsed.data);

    revalidatePath("/app/inbox");

    return {
      message: t(DEFAULT_LOCALE, "mission.inbox.created"),
      ok: true,
    };
  } catch (error) {
    console.error("mission.create.failed", missionActionErrorDetails(error));

    return {
      message: t(DEFAULT_LOCALE, "mission.inbox.unavailable"),
      ok: false,
    };
  }
}
