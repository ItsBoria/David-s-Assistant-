import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { EntityId, UtcIsoDateTime } from "@/lib/domain/shared";

export type SelectedDatePlanAssignment = {
  endsAt: UtcIsoDateTime;
  missionId: EntityId;
  startsAt: UtcIsoDateTime;
};

export type AppliedPlanSession = SelectedDatePlanAssignment & {
  occurrenceId: EntityId;
  sessionId: EntityId;
};

export type AppliedPlanResult = {
  correlationId: EntityId;
  scheduled: AppliedPlanSession[];
};

export async function applySelectedDatePlan(
  supabase: SupabaseClient,
  assignments: SelectedDatePlanAssignment[],
): Promise<AppliedPlanResult> {
  const { data, error } = await supabase.rpc("apply_selected_date_plan", {
    p_assignments: assignments.map((assignment) => ({
      ends_at: assignment.endsAt,
      mission_id: assignment.missionId,
      starts_at: assignment.startsAt,
    })),
  });

  if (error) {
    throw error;
  }

  return parseAppliedPlanResult(data);
}

function parseAppliedPlanResult(value: unknown): AppliedPlanResult {
  if (!isRecord(value) || typeof value.correlationId !== "string") {
    throw new TypeError("The schedule transaction returned an invalid result");
  }

  if (!Array.isArray(value.scheduled)) {
    throw new TypeError("The schedule transaction returned invalid sessions");
  }

  const scheduled = value.scheduled.map((session) => {
    if (
      !isRecord(session) ||
      typeof session.missionId !== "string" ||
      typeof session.occurrenceId !== "string" ||
      typeof session.sessionId !== "string" ||
      typeof session.startsAt !== "string" ||
      typeof session.endsAt !== "string"
    ) {
      throw new TypeError("The schedule transaction returned an invalid session");
    }

    return {
      endsAt: session.endsAt,
      missionId: session.missionId,
      occurrenceId: session.occurrenceId,
      sessionId: session.sessionId,
      startsAt: session.startsAt,
    };
  });

  return { correlationId: value.correlationId, scheduled };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
