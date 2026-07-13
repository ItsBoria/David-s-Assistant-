"use server";

import { revalidatePath } from "next/cache";

import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import { createMissionForInbox } from "@/lib/services/missions";
import { createClient } from "@/lib/supabase/server";
import { createMissionSchema } from "@/lib/validation/mission";

export type CreateMissionActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

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
  } catch {
    return {
      message: t(DEFAULT_LOCALE, "mission.inbox.unavailable"),
      ok: false,
    };
  }
}
