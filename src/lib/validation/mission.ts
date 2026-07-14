import { z } from "zod";

import {
  t,
  type AppLocale,
  type TranslationKey,
} from "../i18n";
import { MissionPriority } from "../domain/mission";
import type { LocalDate } from "../domain/shared";

export const MissionValidationMessage = {
  ID_INVALID: "validation.mission.id.invalid",
  TITLE_REQUIRED: "validation.mission.title.required",
  TITLE_TOO_LONG: "validation.mission.title.tooLong",
  DESCRIPTION_TOO_LONG: "validation.mission.description.tooLong",
  CATEGORY_TOO_LONG: "validation.mission.category.tooLong",
  DURATION_REQUIRED: "validation.mission.duration.required",
  DURATION_TOO_SMALL: "validation.mission.duration.tooSmall",
  DURATION_TOO_LARGE: "validation.mission.duration.tooLarge",
  TARGET_DATE_REQUIRED: "validation.mission.targetDate.required",
  TARGET_DATE_INVALID: "validation.mission.targetDate.invalid",
  PRIORITY_INVALID: "validation.mission.priority.invalid",
} as const satisfies Record<string, TranslationKey>;

const missionValidationMessages = new Set<string>(
  Object.values(MissionValidationMessage),
);

export function localizeMissionValidationMessage(
  locale: AppLocale | string,
  message: string | undefined,
): string | undefined {
  if (!message || !missionValidationMessages.has(message)) {
    return message;
  }

  return t(locale, message as TranslationKey);
}

const optionalTrimmedText = (maxLength: number, tooLongMessage: TranslationKey) =>
  z
    .string()
    .trim()
    .max(maxLength, { message: tooLongMessage })
    .nullish()
    .transform((value) => {
      if (typeof value !== "string") {
        return null;
      }

      return value.length > 0 ? value : null;
    });

const localDateSchema = z
  .string()
  .trim()
  .superRefine((value, context) => {
    if (!value) {
      context.addIssue({
        code: "custom",
        message: MissionValidationMessage.TARGET_DATE_REQUIRED,
      });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      context.addIssue({
        code: "custom",
        message: MissionValidationMessage.TARGET_DATE_INVALID,
      });
      return;
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(value)) {
      context.addIssue({
        code: "custom",
        message: MissionValidationMessage.TARGET_DATE_INVALID,
      });
    }
  })
  .transform((value) => value as LocalDate);

const estimatedDurationMinutesSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? Number(value) : value),
  z
    .number({ message: MissionValidationMessage.DURATION_REQUIRED })
    .int({ message: MissionValidationMessage.DURATION_REQUIRED })
    .min(1, { message: MissionValidationMessage.DURATION_TOO_SMALL })
    .max(10080, { message: MissionValidationMessage.DURATION_TOO_LARGE }),
);

export const createMissionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: MissionValidationMessage.TITLE_REQUIRED })
    .max(240, { message: MissionValidationMessage.TITLE_TOO_LONG }),
  description: optionalTrimmedText(
    2000,
    MissionValidationMessage.DESCRIPTION_TOO_LONG,
  ),
  category: optionalTrimmedText(
    80,
    MissionValidationMessage.CATEGORY_TOO_LONG,
  ),
  estimatedDurationMinutes: estimatedDurationMinutesSchema,
  priority: z.enum(
    [
      MissionPriority.URGENT,
      MissionPriority.HIGH,
      MissionPriority.MEDIUM,
      MissionPriority.LOW,
    ],
    { message: MissionValidationMessage.PRIORITY_INVALID },
  ),
  selectedDate: localDateSchema,
});

const missionIdSchema = z
  .string()
  .uuid({ message: MissionValidationMessage.ID_INVALID });

export const updateMissionSchema = createMissionSchema.extend({
  id: missionIdSchema,
});

export const cancelMissionSchema = z.object({
  id: missionIdSchema,
});

export type CreateMissionInput = z.output<typeof createMissionSchema>;
export type CreateMissionFormValues = z.input<typeof createMissionSchema>;
export type UpdateMissionInput = z.output<typeof updateMissionSchema>;
export type UpdateMissionFormValues = z.input<typeof updateMissionSchema>;
