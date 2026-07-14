import type { ExpectedPlanAssignment } from "@/lib/validation/schedule-plan";

/**
 * The expected snapshot came from the rendered preview. It is never persisted;
 * it only proves that the independently recomputed server plan is unchanged.
 */
export function arePlanSnapshotsEqual(
  actual: readonly ExpectedPlanAssignment[],
  expected: readonly ExpectedPlanAssignment[],
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  return actual.every((assignment, index) => {
    const expectedAssignment = expected[index];
    return (
      expectedAssignment !== undefined &&
      assignment.missionId === expectedAssignment.missionId &&
      assignment.startsAt === expectedAssignment.startsAt &&
      assignment.endsAt === expectedAssignment.endsAt
    );
  });
}
