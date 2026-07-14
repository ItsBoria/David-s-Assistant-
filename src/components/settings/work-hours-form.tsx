"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { saveWorkHoursAction } from "@/app/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WORK_WEEKDAYS } from "@/lib/domain/shared";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import type { WorkHoursSchedule } from "@/lib/repositories/work-hours";
import {
  saveWorkHoursSchema,
  type SaveWorkHoursFormValues,
  type SaveWorkHoursInput,
} from "@/lib/validation/work-hours";

import {
  SettingsFieldError,
  SettingsFormMessage,
} from "./settings-form-message";

const weekdayLabels = {
  0: "weekday.sunday",
  1: "weekday.monday",
  2: "weekday.tuesday",
  3: "weekday.wednesday",
  4: "weekday.thursday",
} as const satisfies Record<(typeof WORK_WEEKDAYS)[number], Parameters<typeof t>[1]>;

export function WorkHoursForm({
  schedule,
}: {
  schedule: WorkHoursSchedule;
}) {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string>();
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<SaveWorkHoursFormValues, unknown, SaveWorkHoursInput>({
    defaultValues: { days: schedule.days },
    resolver: zodResolver(saveWorkHoursSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerMessage(undefined);

    try {
      const result = await saveWorkHoursAction(values);
      setMessageTone(result.ok ? "success" : "error");
      setServerMessage(result.message);

      if (result.ok) {
        router.refresh();
      }
    } catch {
      setMessageTone("error");
      setServerMessage(t(DEFAULT_LOCALE, "settings.workHours.unavailable"));
    }
  });

  return (
    <form
      aria-describedby="work-hours-form-message"
      className="space-y-5"
      noValidate
      onSubmit={onSubmit}
    >
      <SettingsFormMessage
        id="work-hours-form-message"
        message={serverMessage}
        tone={messageTone}
      />

      <div className="space-y-3">
        {schedule.days.map((day, index) => {
          return (
            <div
              className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-[minmax(0,1fr)_140px_140px]"
              key={day.weekday}
            >
              <input
                type="hidden"
                value={day.weekday}
                {...register(`days.${index}.weekday`, {
                  valueAsNumber: true,
                })}
              />
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  className="size-4 rounded border-[var(--input)]"
                  type="checkbox"
                  {...register(`days.${index}.enabled`)}
                />
                {t(DEFAULT_LOCALE, weekdayLabels[day.weekday])}
              </label>

              <div className="space-y-2">
                <Label htmlFor={`day-${day.weekday}-starts`}>
                  {t(DEFAULT_LOCALE, "settings.workHours.startsAt")}
                </Label>
                <Input
                  aria-describedby={
                    errors.days?.[index]?.startsAt
                      ? `day-${day.weekday}-starts-error`
                      : undefined
                  }
                  aria-invalid={Boolean(errors.days?.[index]?.startsAt)}
                  id={`day-${day.weekday}-starts`}
                  type="time"
                  {...register(`days.${index}.startsAt`)}
                />
                <SettingsFieldError
                  id={`day-${day.weekday}-starts-error`}
                  message={errors.days?.[index]?.startsAt?.message}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`day-${day.weekday}-ends`}>
                  {t(DEFAULT_LOCALE, "settings.workHours.endsAt")}
                </Label>
                <Input
                  aria-describedby={
                    errors.days?.[index]?.endsAt
                      ? `day-${day.weekday}-ends-error`
                      : undefined
                  }
                  aria-invalid={Boolean(errors.days?.[index]?.endsAt)}
                  id={`day-${day.weekday}-ends`}
                  type="time"
                  {...register(`days.${index}.endsAt`)}
                />
                <SettingsFieldError
                  id={`day-${day.weekday}-ends-error`}
                  message={errors.days?.[index]?.endsAt?.message}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Save aria-hidden="true" className="size-4" />
        )}
        {isSubmitting
          ? t(DEFAULT_LOCALE, "settings.workHours.saving")
          : t(DEFAULT_LOCALE, "settings.workHours.save")}
      </Button>
    </form>
  );
}
