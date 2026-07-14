"use client";

import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { acceptPlanAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import type { ExpectedPlanAssignment } from "@/lib/validation/schedule-plan";

export function AcceptPlanButton({
  expectedPlan,
}: {
  expectedPlan: ExpectedPlanAssignment[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    ok: boolean;
  }>();

  const acceptPlan = async () => {
    setIsSubmitting(true);
    setResult(undefined);

    try {
      const actionResult = await acceptPlanAction(expectedPlan);
      setResult(actionResult);
      if (actionResult.ok) {
        router.refresh();
      }
    } catch {
      setResult({
        message: t(DEFAULT_LOCALE, "myWeek.plan.acceptUnavailable"),
        ok: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button disabled={isSubmitting} onClick={acceptPlan} type="button">
        {isSubmitting ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Save aria-hidden="true" className="size-4" />
        )}
        {isSubmitting
          ? t(DEFAULT_LOCALE, "myWeek.plan.accepting")
          : t(DEFAULT_LOCALE, "myWeek.plan.accept")}
      </Button>

      {result ? (
        <p
          className={
            result.ok
              ? "flex items-start gap-2 rounded-xl bg-[var(--success-soft)] px-3.5 py-3 text-sm text-[var(--success)]"
              : "rounded-xl bg-[var(--destructive-soft)] px-3.5 py-3 text-sm text-[var(--destructive)]"
          }
          role={result.ok ? "status" : "alert"}
        >
          {result.ok ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          ) : null}
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
