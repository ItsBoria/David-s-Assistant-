import { z } from "zod";

export const expectedPlanAssignmentSchema = z
  .object({
    endsAt: z.string().datetime({ offset: true }),
    missionId: z.string().uuid(),
    startsAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine(
    (assignment) => Date.parse(assignment.endsAt) > Date.parse(assignment.startsAt),
    { message: "Plan assignment end must follow its start" },
  );

export const expectedPlanSchema = z
  .array(expectedPlanAssignmentSchema)
  .min(1)
  .max(100)
  .superRefine((assignments, context) => {
    const missionIds = new Set<string>();
    for (const assignment of assignments) {
      if (missionIds.has(assignment.missionId)) {
        context.addIssue({
          code: "custom",
          message: "A mission can appear only once in this plan",
        });
      }
      missionIds.add(assignment.missionId);
    }
  });

export type ExpectedPlanAssignment = z.infer<
  typeof expectedPlanAssignmentSchema
>;
