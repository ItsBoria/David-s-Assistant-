import { z } from "zod";

import { WORK_WEEKDAYS, type LocalTime, type WorkWeekday } from "@/lib/domain/shared";
import { t, type AppLocale, type TranslationKey } from "@/lib/i18n";

export const WorkHoursValidationMessage = {
  TIME_INVALID: "validation.workHours.time.invalid",
  TIME_ORDER: "validation.workHours.time.order",
  DAY_REQUIRED: "validation.workHours.day.required",
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

export type SaveWorkHoursInput = z.output<typeof saveWorkHoursSchema>;
export type SaveWorkHoursFormValues = z.input<typeof saveWorkHoursSchema>;
