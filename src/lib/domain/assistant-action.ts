import type {
  EntityId,
  LocalDate,
  LocalTime,
} from "./shared";
import type {
  MissionPriority,
  MissionScheduleConstraint,
  MissionStatus,
} from "./mission";
import type { WorkPeriod } from "./work-schedule";

interface ParsedActionBase {
  confidence: number;
  originalText: string;
}

export interface CreateMissionAction extends ParsedActionBase {
  type: "create_mission";
  payload: {
    title: string;
    description?: string;
    estimatedDurationMinutes: number;
    priority: MissionPriority;
    schedule: MissionScheduleConstraint;
  };
}

export interface CreateMeetingAction extends ParsedActionBase {
  type: "create_meeting";
  payload: {
    title: string;
    date: LocalDate;
    startsAt: LocalTime;
    endsAt: LocalTime;
    location?: string;
  };
}

export interface CompleteMissionAction extends ParsedActionBase {
  type: "complete_mission";
  payload: {
    missionId?: EntityId;
    missionTitle?: string;
    status: Extract<
      MissionStatus,
      "completed" | "partially_completed"
    >;
    actualDurationMinutes?: number;
  };
}

export interface RescheduleMissionAction extends ParsedActionBase {
  type: "reschedule_mission";
  payload: {
    missionId?: EntityId;
    missionTitle?: string;
    schedule: MissionScheduleConstraint;
  };
}

export interface ChangeWorkHoursAction extends ParsedActionBase {
  type: "change_work_hours";
  payload:
    | { date: LocalDate; kind: "day_off" }
    | { date: LocalDate; kind: "custom_hours"; periods: readonly WorkPeriod[] };
}

export interface ShowScheduleAction extends ParsedActionBase {
  type: "show_schedule";
  payload: { range: "today" | "current_week" | "next_item" };
}

/**
 * Parsers may produce this structure, but callers must still validate and ask for
 * confirmation before executing a state-changing action.
 */
export type ParsedAssistantAction =
  | CreateMissionAction
  | CreateMeetingAction
  | CompleteMissionAction
  | RescheduleMissionAction
  | ChangeWorkHoursAction
  | ShowScheduleAction;

export interface AssistantActionParser {
  parse(input: string, locale: string): Promise<ParsedAssistantAction | null>;
}
