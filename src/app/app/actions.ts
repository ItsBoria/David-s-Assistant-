"use server";

import { revalidatePath } from "next/cache";

import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import {
  acceptCurrentWeekPlan,
  NoSchedulableMissionsError,
  PlanPreviewChangedError,
} from "@/lib/services/schedule-plan";
import { createClient } from "@/lib/supabase/server";
import { expectedPlanSchema } from "@/lib/validation/schedule-plan";

export type AcceptPlanActionResult =
  | { ok: true; message: string; scheduledCount: number }
  | { ok: false; message: string };

export async function acceptPlanAction(
  expectedPlan: unknown,
): Promise<AcceptPlanActionResult> {
  const parsedExpectedPlan = expectedPlanSchema.safeParse(expectedPlan);
  if (!parsedExpectedPlan.success) {
    return {
      message: t(DEFAULT_LOCALE, "myWeek.plan.previewChanged"),
      ok: false,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const ownerId = data?.claims?.sub;

    if (error || typeof ownerId !== "string") {
      return {
        message: t(DEFAULT_LOCALE, "myWeek.plan.authRequired"),
        ok: false,
      };
    }

    const result = await acceptCurrentWeekPlan(
      { ownerId, supabase },
      parsedExpectedPlan.data,
    );
    revalidatePath("/app");
    revalidatePath("/app/inbox");

    return {
      message: t(DEFAULT_LOCALE, "myWeek.plan.accepted", {
        count: result.scheduled.length,
      }),
      ok: true,
      scheduledCount: result.scheduled.length,
    };
  } catch (error) {
    if (
      error instanceof NoSchedulableMissionsError ||
      error instanceof PlanPreviewChangedError
    ) {
      return {
        message: t(
          DEFAULT_LOCALE,
          error instanceof PlanPreviewChangedError
            ? "myWeek.plan.previewChanged"
            : "myWeek.plan.nothingToAccept",
        ),
        ok: false,
      };
    }

    console.error("schedule.plan.accept.failed", {
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : undefined,
      name: error instanceof Error ? error.name : undefined,
    });

    return {
      message: t(DEFAULT_LOCALE, "myWeek.plan.acceptUnavailable"),
      ok: false,
    };
  }
}
