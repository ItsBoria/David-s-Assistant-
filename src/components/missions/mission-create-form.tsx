"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createMissionAction } from "@/app/app/inbox/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import {
  createMissionSchema,
  type CreateMissionInput,
  type CreateMissionFormValues,
} from "@/lib/validation/mission";
import { MissionPriority } from "@/lib/domain/mission";

import {
  MissionFieldError,
  MissionFormMessage,
} from "./mission-form-message";

function todayLocalDate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

const fieldClassName =
  "flex min-h-24 w-full rounded-xl border border-[var(--input)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-[var(--destructive)] aria-invalid:ring-2 aria-invalid:ring-[var(--destructive-soft)]";

const selectClassName =
  "flex h-11 w-full rounded-xl border border-[var(--input)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none transition focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-[var(--destructive)] aria-invalid:ring-2 aria-invalid:ring-[var(--destructive-soft)]";

export function MissionCreateForm() {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string>();
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateMissionFormValues, unknown, CreateMissionInput>({
    defaultValues: {
      category: "",
      description: "",
      estimatedDurationMinutes: 60,
      priority: MissionPriority.MEDIUM,
      selectedDate: todayLocalDate(),
      title: "",
    },
    resolver: zodResolver(createMissionSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerMessage(undefined);

    try {
      const result = await createMissionAction(values);
      setMessageTone(result.ok ? "success" : "error");
      setServerMessage(result.message);

      if (result.ok) {
        reset({
          category: "",
          description: "",
          estimatedDurationMinutes: 60,
          priority: MissionPriority.MEDIUM,
          selectedDate: todayLocalDate(),
          title: "",
        });
        router.refresh();
      }
    } catch {
      setMessageTone("error");
      setServerMessage(t(DEFAULT_LOCALE, "mission.inbox.unavailable"));
    }
  });

  return (
    <form
      aria-describedby="create-mission-form-message"
      className="space-y-5"
      noValidate
      onSubmit={onSubmit}
    >
      <MissionFormMessage
        id="create-mission-form-message"
        message={serverMessage}
        tone={messageTone}
      />

      <div className="space-y-2">
        <Label htmlFor="mission-title">
          {t(DEFAULT_LOCALE, "mission.inbox.titleLabel")}
        </Label>
        <Input
          aria-describedby={errors.title ? "mission-title-error" : undefined}
          aria-invalid={Boolean(errors.title)}
          autoComplete="off"
          autoFocus
          id="mission-title"
          placeholder={t(DEFAULT_LOCALE, "mission.inbox.titlePlaceholder")}
          {...register("title")}
        />
        <MissionFieldError
          id="mission-title-error"
          message={errors.title?.message}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mission-description">
          {t(DEFAULT_LOCALE, "mission.inbox.descriptionLabel")}
        </Label>
        <textarea
          aria-describedby={
            errors.description ? "mission-description-error" : undefined
          }
          aria-invalid={Boolean(errors.description)}
          className={fieldClassName}
          id="mission-description"
          placeholder={t(
            DEFAULT_LOCALE,
            "mission.inbox.descriptionPlaceholder",
          )}
          {...register("description")}
        />
        <MissionFieldError
          id="mission-description-error"
          message={errors.description?.message}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="mission-duration">
            {t(DEFAULT_LOCALE, "mission.inbox.durationLabel")}
          </Label>
          <Input
            aria-describedby={
              errors.estimatedDurationMinutes
                ? "mission-duration-error"
                : undefined
            }
            aria-invalid={Boolean(errors.estimatedDurationMinutes)}
            id="mission-duration"
            inputMode="numeric"
            min={1}
            type="number"
            {...register("estimatedDurationMinutes")}
          />
          <MissionFieldError
            id="mission-duration-error"
            message={errors.estimatedDurationMinutes?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mission-target-date">
            {t(DEFAULT_LOCALE, "mission.inbox.targetDateLabel")}
          </Label>
          <Input
            aria-describedby={
              errors.selectedDate ? "mission-target-date-error" : undefined
            }
            aria-invalid={Boolean(errors.selectedDate)}
            id="mission-target-date"
            type="date"
            {...register("selectedDate")}
          />
          <MissionFieldError
            id="mission-target-date-error"
            message={errors.selectedDate?.message}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mission-priority">
            {t(DEFAULT_LOCALE, "mission.inbox.priorityLabel")}
          </Label>
          <select
            aria-describedby={
              errors.priority ? "mission-priority-error" : undefined
            }
            aria-invalid={Boolean(errors.priority)}
            className={selectClassName}
            id="mission-priority"
            {...register("priority")}
          >
            <option value={MissionPriority.URGENT}>
              {t(DEFAULT_LOCALE, "mission.priority.urgent")}
            </option>
            <option value={MissionPriority.HIGH}>
              {t(DEFAULT_LOCALE, "mission.priority.high")}
            </option>
            <option value={MissionPriority.MEDIUM}>
              {t(DEFAULT_LOCALE, "mission.priority.medium")}
            </option>
            <option value={MissionPriority.LOW}>
              {t(DEFAULT_LOCALE, "mission.priority.low")}
            </option>
          </select>
          <MissionFieldError
            id="mission-priority-error"
            message={errors.priority?.message}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mission-category">
          {t(DEFAULT_LOCALE, "mission.inbox.categoryLabel")}
        </Label>
        <Input
          aria-describedby={
            errors.category ? "mission-category-error" : undefined
          }
          aria-invalid={Boolean(errors.category)}
          id="mission-category"
          placeholder={t(DEFAULT_LOCALE, "mission.inbox.categoryPlaceholder")}
          {...register("category")}
        />
        <MissionFieldError
          id="mission-category-error"
          message={errors.category?.message}
        />
      </div>

      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <PlusCircle aria-hidden="true" className="size-4" />
        )}
        {isSubmitting
          ? t(DEFAULT_LOCALE, "mission.inbox.submitting")
          : t(DEFAULT_LOCALE, "mission.inbox.submit")}
      </Button>
    </form>
  );
}
