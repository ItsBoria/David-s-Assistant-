"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, LoaderCircle, Pencil, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  cancelMissionAction,
  updateMissionAction,
} from "@/app/app/inbox/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MissionPriority } from "@/lib/domain/mission";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import type { MissionInboxItem } from "@/lib/repositories/missions";
import {
  updateMissionSchema,
  type UpdateMissionFormValues,
  type UpdateMissionInput,
} from "@/lib/validation/mission";

import {
  MissionFieldError,
  MissionFormMessage,
} from "./mission-form-message";

const textAreaClassName =
  "flex min-h-24 w-full rounded-xl border border-[var(--input)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-[var(--destructive)] aria-invalid:ring-2 aria-invalid:ring-[var(--destructive-soft)]";

const selectClassName =
  "flex h-11 w-full rounded-xl border border-[var(--input)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none transition focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-[var(--destructive)] aria-invalid:ring-2 aria-invalid:ring-[var(--destructive-soft)]";

export function MissionItemActions({ mission }: { mission: MissionInboxItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [serverMessage, setServerMessage] = useState<string>();
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const formId = `edit-mission-${mission.id}`;
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<UpdateMissionFormValues, unknown, UpdateMissionInput>({
    defaultValues: {
      category: mission.category ?? "",
      description: mission.description ?? "",
      estimatedDurationMinutes: mission.estimatedDurationMinutes,
      id: mission.id,
      priority: mission.priority,
      selectedDate: mission.selectedDate,
      title: mission.title,
    },
    resolver: zodResolver(updateMissionSchema),
  });

  const closeEditor = () => {
    reset();
    setEditing(false);
    setServerMessage(undefined);
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerMessage(undefined);

    try {
      const result = await updateMissionAction(values);
      setMessageTone(result.ok ? "success" : "error");
      setServerMessage(result.message);

      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
    } catch {
      setMessageTone("error");
      setServerMessage(t(DEFAULT_LOCALE, "mission.inbox.updateUnavailable"));
    }
  });

  const cancelMission = async () => {
    setCancelling(true);
    setServerMessage(undefined);

    try {
      const result = await cancelMissionAction({ id: mission.id });
      setMessageTone(result.ok ? "success" : "error");
      setServerMessage(result.message);

      if (result.ok) {
        router.refresh();
        return;
      }
    } catch {
      setMessageTone("error");
      setServerMessage(t(DEFAULT_LOCALE, "mission.inbox.cancelUnavailable"));
    } finally {
      setCancelling(false);
      setConfirmingCancel(false);
    }
  };

  if (!editing) {
    return (
      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <MissionFormMessage
          id={`${formId}-message`}
          message={serverMessage}
          tone={messageTone}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              setConfirmingCancel(false);
              setEditing(true);
              setServerMessage(undefined);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            {t(DEFAULT_LOCALE, "common.edit")}
          </Button>

          {confirmingCancel ? (
            <>
              <span className="text-sm text-[var(--destructive)]">
                {t(DEFAULT_LOCALE, "mission.inbox.cancelConfirm")}
              </span>
              <Button
                className="border border-[var(--destructive)]/30 bg-[var(--destructive-soft)] text-[var(--destructive)] hover:bg-[var(--destructive-soft)]"
                disabled={cancelling}
                onClick={cancelMission}
                size="sm"
                type="button"
                variant="outline"
              >
                {cancelling ? (
                  <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                ) : (
                  <Ban aria-hidden="true" className="size-3.5" />
                )}
                {cancelling
                  ? t(DEFAULT_LOCALE, "mission.inbox.cancelling")
                  : t(DEFAULT_LOCALE, "mission.inbox.confirmCancel")}
              </Button>
              <Button
                disabled={cancelling}
                onClick={() => setConfirmingCancel(false)}
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
              onClick={() => setConfirmingCancel(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Ban aria-hidden="true" className="size-3.5" />
              {t(DEFAULT_LOCALE, "mission.inbox.cancelMission")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      aria-describedby={`${formId}-message`}
      className="mt-5 space-y-4 border-t border-[var(--border)] pt-5"
      id={formId}
      noValidate
      onSubmit={onSubmit}
    >
      <input type="hidden" {...register("id")} />
      <MissionFormMessage
        id={`${formId}-message`}
        message={serverMessage}
        tone={messageTone}
      />

      <div className="space-y-2">
        <Label htmlFor={`${formId}-title`}>
          {t(DEFAULT_LOCALE, "mission.inbox.titleLabel")}
        </Label>
        <Input
          aria-describedby={errors.title ? `${formId}-title-error` : undefined}
          aria-invalid={Boolean(errors.title)}
          autoFocus
          id={`${formId}-title`}
          {...register("title")}
        />
        <MissionFieldError
          id={`${formId}-title-error`}
          message={errors.title?.message}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-description`}>
          {t(DEFAULT_LOCALE, "mission.inbox.descriptionLabel")}
        </Label>
        <textarea
          aria-describedby={
            errors.description ? `${formId}-description-error` : undefined
          }
          aria-invalid={Boolean(errors.description)}
          className={textAreaClassName}
          id={`${formId}-description`}
          {...register("description")}
        />
        <MissionFieldError
          id={`${formId}-description-error`}
          message={errors.description?.message}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-duration`}>
            {t(DEFAULT_LOCALE, "mission.inbox.durationLabel")}
          </Label>
          <Input
            aria-describedby={
              errors.estimatedDurationMinutes
                ? `${formId}-duration-error`
                : undefined
            }
            aria-invalid={Boolean(errors.estimatedDurationMinutes)}
            id={`${formId}-duration`}
            min={1}
            type="number"
            {...register("estimatedDurationMinutes")}
          />
          <MissionFieldError
            id={`${formId}-duration-error`}
            message={errors.estimatedDurationMinutes?.message}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-date`}>
            {t(DEFAULT_LOCALE, "mission.inbox.targetDateLabel")}
          </Label>
          <Input
            aria-describedby={
              errors.selectedDate ? `${formId}-date-error` : undefined
            }
            aria-invalid={Boolean(errors.selectedDate)}
            id={`${formId}-date`}
            type="date"
            {...register("selectedDate")}
          />
          <MissionFieldError
            id={`${formId}-date-error`}
            message={errors.selectedDate?.message}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-priority`}>
            {t(DEFAULT_LOCALE, "mission.inbox.priorityLabel")}
          </Label>
          <select
            aria-describedby={
              errors.priority ? `${formId}-priority-error` : undefined
            }
            aria-invalid={Boolean(errors.priority)}
            className={selectClassName}
            id={`${formId}-priority`}
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
            id={`${formId}-priority-error`}
            message={errors.priority?.message}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-category`}>
          {t(DEFAULT_LOCALE, "mission.inbox.categoryLabel")}
        </Label>
        <Input
          aria-describedby={
            errors.category ? `${formId}-category-error` : undefined
          }
          aria-invalid={Boolean(errors.category)}
          id={`${formId}-category`}
          {...register("category")}
        />
        <MissionFieldError
          id={`${formId}-category-error`}
          message={errors.category?.message}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={isSubmitting} size="sm" type="submit">
          {isSubmitting ? (
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-3.5" />
          )}
          {isSubmitting
            ? t(DEFAULT_LOCALE, "common.saving")
            : t(DEFAULT_LOCALE, "common.save")}
        </Button>
        <Button
          disabled={isSubmitting}
          onClick={closeEditor}
          size="sm"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" className="size-3.5" />
          {t(DEFAULT_LOCALE, "common.cancel")}
        </Button>
      </div>
    </form>
  );
}
