"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarOff, Clock3, LoaderCircle, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  removeDateOverrideAction,
  saveDateOverrideAction,
} from "@/app/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateOverrideKind } from "@/lib/domain/work-schedule";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import type { DateScheduleOverrideItem } from "@/lib/repositories/date-overrides";
import {
  saveDateOverrideSchema,
  type SaveDateOverrideFormValues,
  type SaveDateOverrideInput,
} from "@/lib/validation/work-hours";

import {
  SettingsFieldError,
  SettingsFormMessage,
} from "./settings-form-message";

const selectClassName =
  "flex h-11 w-full rounded-xl border border-[var(--input)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none transition focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-[var(--destructive)] aria-invalid:ring-2 aria-invalid:ring-[var(--destructive-soft)]";

const textAreaClassName =
  "flex min-h-20 w-full rounded-xl border border-[var(--input)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-[var(--destructive)] aria-invalid:ring-2 aria-invalid:ring-[var(--destructive-soft)]";

function todayLocalDate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function defaultValues(): SaveDateOverrideFormValues {
  return {
    endsAt: "17:00",
    kind: DateOverrideKind.DAY_OFF,
    overrideDate: todayLocalDate(),
    reason: "",
    startsAt: "09:00",
  };
}

function formatLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function OverrideSummary({ override }: { override: DateScheduleOverrideItem }) {
  if (override.kind === DateOverrideKind.DAY_OFF) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
        <CalendarOff aria-hidden="true" className="size-4 text-[var(--muted-foreground)]" />
        {t(DEFAULT_LOCALE, "settings.dateOverrides.dayOff")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
      <Clock3 aria-hidden="true" className="size-4 text-[var(--primary)]" />
      {t(DEFAULT_LOCALE, "settings.dateOverrides.customHoursSummary", {
        endsAt: override.endsAt ?? "",
        startsAt: override.startsAt ?? "",
      })}
    </span>
  );
}

export function DateOverrideManager({
  overrides,
}: {
  overrides: DateScheduleOverrideItem[];
}) {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string>();
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [confirmRemoveDate, setConfirmRemoveDate] = useState<string>();
  const [removingDate, setRemovingDate] = useState<string>();
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<SaveDateOverrideFormValues, unknown, SaveDateOverrideInput>({
    defaultValues: defaultValues(),
    resolver: zodResolver(saveDateOverrideSchema),
  });
  const kind = useWatch({ control, name: "kind" });

  const onSubmit = handleSubmit(async (values) => {
    setServerMessage(undefined);

    try {
      const result = await saveDateOverrideAction(values);
      setMessageTone(result.ok ? "success" : "error");
      setServerMessage(result.message);

      if (result.ok) {
        reset(defaultValues());
        router.refresh();
      }
    } catch {
      setMessageTone("error");
      setServerMessage(t(DEFAULT_LOCALE, "settings.dateOverrides.unavailable"));
    }
  });

  const removeOverride = async (overrideDate: string) => {
    setRemovingDate(overrideDate);
    setServerMessage(undefined);

    try {
      const result = await removeDateOverrideAction({ overrideDate });
      setMessageTone(result.ok ? "success" : "error");
      setServerMessage(result.message);

      if (result.ok) {
        router.refresh();
      }
    } catch {
      setMessageTone("error");
      setServerMessage(
        t(DEFAULT_LOCALE, "settings.dateOverrides.removeUnavailable"),
      );
    } finally {
      setRemovingDate(undefined);
      setConfirmRemoveDate(undefined);
    }
  };

  return (
    <div className="space-y-7">
      <form
        aria-describedby="date-override-form-message"
        className="space-y-5"
        noValidate
        onSubmit={onSubmit}
      >
        <SettingsFormMessage
          id="date-override-form-message"
          message={serverMessage}
          tone={messageTone}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="date-override-date">
              {t(DEFAULT_LOCALE, "settings.dateOverrides.date")}
            </Label>
            <Input
              aria-describedby={
                errors.overrideDate ? "date-override-date-error" : undefined
              }
              aria-invalid={Boolean(errors.overrideDate)}
              id="date-override-date"
              type="date"
              {...register("overrideDate")}
            />
            <SettingsFieldError
              id="date-override-date-error"
              message={errors.overrideDate?.message}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-override-kind">
              {t(DEFAULT_LOCALE, "settings.dateOverrides.kind")}
            </Label>
            <select
              aria-describedby={
                errors.kind ? "date-override-kind-error" : undefined
              }
              aria-invalid={Boolean(errors.kind)}
              className={selectClassName}
              id="date-override-kind"
              {...register("kind")}
            >
              <option value={DateOverrideKind.DAY_OFF}>
                {t(DEFAULT_LOCALE, "settings.dateOverrides.dayOff")}
              </option>
              <option value={DateOverrideKind.CUSTOM_HOURS}>
                {t(DEFAULT_LOCALE, "settings.dateOverrides.customHours")}
              </option>
            </select>
            <SettingsFieldError
              id="date-override-kind-error"
              message={errors.kind?.message}
            />
          </div>
        </div>

        {kind === DateOverrideKind.CUSTOM_HOURS ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date-override-starts">
                {t(DEFAULT_LOCALE, "settings.workHours.startsAt")}
              </Label>
              <Input
                aria-describedby={
                  errors.startsAt ? "date-override-starts-error" : undefined
                }
                aria-invalid={Boolean(errors.startsAt)}
                id="date-override-starts"
                type="time"
                {...register("startsAt")}
              />
              <SettingsFieldError
                id="date-override-starts-error"
                message={errors.startsAt?.message}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-override-ends">
                {t(DEFAULT_LOCALE, "settings.workHours.endsAt")}
              </Label>
              <Input
                aria-describedby={
                  errors.endsAt ? "date-override-ends-error" : undefined
                }
                aria-invalid={Boolean(errors.endsAt)}
                id="date-override-ends"
                type="time"
                {...register("endsAt")}
              />
              <SettingsFieldError
                id="date-override-ends-error"
                message={errors.endsAt?.message}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="date-override-reason">
            {t(DEFAULT_LOCALE, "settings.dateOverrides.reason")}
          </Label>
          <textarea
            aria-describedby={
              errors.reason ? "date-override-reason-error" : undefined
            }
            aria-invalid={Boolean(errors.reason)}
            className={textAreaClassName}
            id="date-override-reason"
            placeholder={t(
              DEFAULT_LOCALE,
              "settings.dateOverrides.reasonPlaceholder",
            )}
            {...register("reason")}
          />
          <SettingsFieldError
            id="date-override-reason-error"
            message={errors.reason?.message}
          />
        </div>

        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          {isSubmitting
            ? t(DEFAULT_LOCALE, "settings.dateOverrides.saving")
            : t(DEFAULT_LOCALE, "settings.dateOverrides.save")}
        </Button>
      </form>

      <div className="border-t border-[var(--border)] pt-6">
        <h3 className="text-sm font-semibold">
          {t(DEFAULT_LOCALE, "settings.dateOverrides.savedTitle")}
        </h3>
        {overrides.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {overrides.map((override) => {
              const isConfirming = confirmRemoveDate === override.overrideDate;
              const isRemoving = removingDate === override.overrideDate;

              return (
                <li
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={override.id}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {formatLocalDate(override.overrideDate)}
                    </p>
                    <div className="mt-1">
                      <OverrideSummary override={override} />
                    </div>
                    {override.reason ? (
                      <p className="mt-1 text-sm leading-5 text-[var(--muted-foreground)]">
                        {override.reason}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isConfirming ? (
                      <>
                        <span className="text-xs text-[var(--destructive)]">
                          {t(DEFAULT_LOCALE, "settings.dateOverrides.removeConfirm")}
                        </span>
                        <Button
                          className="text-[var(--destructive)] hover:text-[var(--destructive)]"
                          disabled={isRemoving}
                          onClick={() => removeOverride(override.overrideDate)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {isRemoving ? (
                            <LoaderCircle
                              aria-hidden="true"
                              className="size-3.5 animate-spin"
                            />
                          ) : (
                            <Trash2 aria-hidden="true" className="size-3.5" />
                          )}
                          {t(DEFAULT_LOCALE, "common.confirm")}
                        </Button>
                        <Button
                          disabled={isRemoving}
                          onClick={() => setConfirmRemoveDate(undefined)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {t(DEFAULT_LOCALE, "common.back")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        className="text-[var(--destructive)] hover:text-[var(--destructive)]"
                        onClick={() => setConfirmRemoveDate(override.overrideDate)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                        {t(DEFAULT_LOCALE, "settings.dateOverrides.remove")}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-4 text-sm text-[var(--muted-foreground)]">
            {t(DEFAULT_LOCALE, "settings.dateOverrides.empty")}
          </p>
        )}
      </div>
    </div>
  );
}
