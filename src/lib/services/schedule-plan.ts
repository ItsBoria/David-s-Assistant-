import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserId } from "@/lib/domain/shared";
import { arePlanSnapshotsEqual } from "@/lib/planning/acceptance";
import {
  applySelectedDatePlan,
  type AppliedPlanResult,
  type SelectedDatePlanAssignment,
} from "@/lib/repositories/schedule-plan";
import { getMyWeekWorkspace } from "@/lib/services/my-week";
import type { ExpectedPlanAssignment } from "@/lib/validation/schedule-plan";

const MAX_ASSIGNMENTS_PER_PLAN = 100;

type SchedulePlanServiceContext = {
  now?: Date;
  ownerId: UserId;
  supabase: SupabaseClient;
};

export class NoSchedulableMissionsError extends Error {
  constructor() {
    super("There are no schedulable missions in the current preview");
    this.name = "NoSchedulableMissionsError";
  }
}

export class PlanPreviewChangedError extends Error {
  constructor() {
    super("The plan preview changed before it was accepted");
    this.name = "PlanPreviewChangedError";
  }
}

export async function acceptCurrentWeekPlan(
  context: SchedulePlanServiceContext,
  expectedAssignments: ExpectedPlanAssignment[],
): Promise<AppliedPlanResult> {
  const workspace = await getMyWeekWorkspace(context);
  const assignments: SelectedDatePlanAssignment[] =
    workspace.planPreview.scheduled.map((session) => ({
      endsAt: session.endsAt,
      missionId: session.missionId,
      startsAt: session.startsAt,
    }));

  if (assignments.length === 0) {
    throw new NoSchedulableMissionsError();
  }

  if (assignments.length > MAX_ASSIGNMENTS_PER_PLAN) {
    throw new RangeError(
      `A plan can contain at most ${MAX_ASSIGNMENTS_PER_PLAN} assignments`,
    );
  }

  if (new Set(assignments.map((assignment) => assignment.missionId)).size !== assignments.length) {
    throw new Error("The selected-date plan unexpectedly split a mission");
  }

  if (!arePlanSnapshotsEqual(assignments, expectedAssignments)) {
    throw new PlanPreviewChangedError();
  }

  return applySelectedDatePlan(context.supabase, assignments);
}
