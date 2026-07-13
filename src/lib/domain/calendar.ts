import type {
  EntityId,
  OwnedEntity,
  TimeRange,
} from "./shared";
import type { MissionPriority, MissionStatus } from "./mission";

export const ParticipantStatus = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  RESCHEDULE_REQUESTED: "reschedule_requested",
  CANCELLED: "cancelled",
} as const;

export type ParticipantStatus =
  (typeof ParticipantStatus)[keyof typeof ParticipantStatus];

export interface Meeting extends OwnedEntity, TimeRange {
  title: string;
  description: string | null;
  location: string | null;
  meetingUrl: string | null;
  organizerContactId: EntityId | null;
  notes: string | null;
}

export interface MeetingParticipant extends OwnedEntity {
  meetingId: EntityId;
  contactId: EntityId;
  status: ParticipantStatus;
}

interface CalendarItemBase extends TimeRange {
  id: EntityId;
  title: string;
}

export interface MissionCalendarItem extends CalendarItemBase {
  kind: "mission";
  missionId: EntityId;
  occurrenceId: EntityId;
  status: MissionStatus;
  priority: MissionPriority;
  locked: boolean;
}

export interface MeetingCalendarItem extends CalendarItemBase {
  kind: "meeting";
  meetingId: EntityId;
  location: string | null;
}

export interface UnavailableCalendarItem extends CalendarItemBase {
  kind: "unavailable";
  unavailablePeriodId: EntityId;
}

export type CalendarItem =
  | MissionCalendarItem
  | MeetingCalendarItem
  | UnavailableCalendarItem;
