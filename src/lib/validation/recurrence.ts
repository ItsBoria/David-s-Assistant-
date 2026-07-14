import { z } from "zod";

import { isLocalDate } from "@/lib/dates";
import type { LocalDate } from "@/lib/domain/shared";

const localDateSchema = z
  .string()
  .refine(isLocalDate, { message: "A valid local date is required" })
  .transform((value) => value as LocalDate);

export const generateMissionOccurrencesSchema = z
  .object({
    missionId: z.string().uuid(),
    throughDate: localDateSchema,
  })
  .strict();

export const generatedMissionOccurrenceSchema = z
  .object({
    id: z.string().uuid(),
    occurrenceDate: localDateSchema,
    recurrenceKey: z.string().regex(/^date:\d{4}-\d{2}-\d{2}$/),
    sequenceNumber: z.number().int().positive(),
  })
  .strict();

export const generatedMissionOccurrencesResultSchema = z
  .object({
    correlationId: z.string().uuid(),
    createdCount: z.number().int().nonnegative(),
    exhausted: z.boolean(),
    generatedThrough: localDateSchema.nullable(),
    missionId: z.string().uuid(),
    occurrences: z.array(generatedMissionOccurrenceSchema),
    recurrenceRuleId: z.string().uuid(),
  })
  .strict()
  .refine((result) => result.createdCount === result.occurrences.length, {
    message: "Generated occurrence count does not match the returned rows",
  });

export type GenerateMissionOccurrencesInput = z.output<
  typeof generateMissionOccurrencesSchema
>;
export type GeneratedMissionOccurrencesResult = z.output<
  typeof generatedMissionOccurrencesResultSchema
>;
