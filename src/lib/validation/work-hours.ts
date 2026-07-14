import { z } from "zod";

import { isLocalDate } from "@/lib/dates/work-week";
import { WORK_WEEKDAYS, type LocalDate, type LocalTime, type WorkWeekday } from "@/lib/domain/shared";
import { DateOverrideKind } from "@/lib/domain/work-schedule";
import { t, type AppLocale, type TranslationKey } from "@/lib/i18n";

export const WorkHoursValidationMessage = {
  TIME_INVALID: "validation.workHours.time.invalid",
  TIME_ORDER: "validation.workHours.time.order",
  DAY_REQUIRED: "validation.workHours.day.required",
  DATE_REQUIRED: "validation.dateOverride.date.required",
  DATE_INVALID: "validation.dateOverride.date.invalid",
  KIND_INVALID: "validation.dateOverride.kind.invalid",
  REASON_TOO_LONG: "validation.dateOverride.reason.tooLong",
} as const satisfies Record<string, TranslationKey>;

const workHoursValidationMessages = new Set<string>(
  Object.values(WorkHoursValidationMessage),
);

export function localizeWorkHoursValidationMessage(
  locale: AppLocale | string,
  message: string | undefined,
): string | undefined {
  if (!message || !workHoursValidationMessages.has(message)) {
    return message;
  }

  return t(locale, message as TranslationKey);
}

const localTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: WorkHoursValidationMessage.TIME_INVALID,
  })
  .transform((value) => value as LocalTime);

export const workHoursDaySchema = z
  .object({
    enabled: z.boolean(),
    startsAt: localTimeSchema,
    endsAt: localTimeSchema,
    weekday: z
      .number()
      .int()
      .refine(
        (value): value is WorkWeekday =>
          (WORK_WEEKDAYS as readonly number[]).includes(value),
        { message: WorkHoursValidationMessage.DAY_REQUIRED },
      ),
  })
  .superRefine((day, context) => {
    if (day.enabled && day.startsAt >= day.endsAt) {
      context.addIssue({
        code: "custom",
        message: WorkHoursValidationMessage.TIME_ORDER,
        path: ["endsAt"],
      });
    }
  });

export const saveWorkHoursSchema = z.object({
  days: z
    .array(workHoursDaySchema)
    .length(WORK_WEEKDAYS.length, {
      message: WorkHoursValidationMessage.DAY_REQUIRED,
    }),
});

const localDateSchema = z
  .string()
  .trim()
  .min(1, { message: WorkHoursValidationMessage.DATE_REQUIRED })
  .refine(isLocalDate, { message: WorkHoursValidationMessage.DATE_INVALID })
  .transform((value) => value as LocalDate);

const optionalReasonSchema = z
  .string()
  .trim()
  .max(500, { message: WorkHoursValidationMessage.REASON_TOO_LONG })
  .nullish()
  .transform((value) => value || null);

const dateOverrideBaseShape = {
  overrideDate: localDateSchema,
  reason: optionalReasonSchema,
};

export const saveDateOverrideSchema = z
  .discriminatedUnion("kind", [
    z.object({
      ...dateOverrideBaseShape,
      endsAt: localTimeSchema,
      kind: z.literal(DateOverrideKind.CUSTOM_HOURS, {
        message: WorkHoursValidationMessage.KIND_INVALID,
      }),
      startsAt: localTimeSchema,
    }),
    z.object({
      ...dateOverrideBaseShape,
      endsAt: z.string().optional().default(""),
      kind: z.literal(DateOverrideKind.DAY_OFF, {
        message: WorkHoursValidationMessage.KIND_INVALID,
      }),
      startsAt: z.string().optional().default(""),
    }),
  ])
  .superRefine((override, context) => {
    if (
      override.kind === DateOverrideKind.CUSTOM_HOURS &&
      override.startsAt >= override.endsAt
    ) {
      context.addIssue({
        code: "custom",
        message: WorkHoursValidationMessage.TIME_ORDER,
        path: ["endsAt"],
      });
    }
  });

export const removeDateOverrideSchema = z.object({
  overrideDate: localDateSchema,
});

export type SaveWorkHoursInput = z.output<typeof saveWorkHoursSchema>;
export type SaveWorkHoursFormValues = z.input<typeof saveWorkHoursSchema>;
export type SaveDateOverrideInput = z.output<typeof saveDateOverrideSchema>;
export type SaveDateOverrideFormValues = z.input<typeof saveDateOverrideSchema>;
