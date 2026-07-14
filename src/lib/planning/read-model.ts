import { fromLocalDateTime, toLocalDate } from "@/lib/dates";
import type { MissionPriority } from "@/lib/domain/mission";
import { SchedulingMode } from "@/lib/domain/mission";
import type { LocalDate, UtcIsoDateTime } from "@/lib/domain/shared";
import type { MyWeekReadModel } from "@/lib/my-week/read-model";
import {
  BlockingPeriodKind,
  planMissions,
  type BlockingPeriodKind as BlockingPeriodKindValue,
  type UnscheduledReason,
} from "@/lib/scheduling";

export type PlanningSettings = {
  bufferAfterMinutes: number;
  bufferBeforeMinutes: number;
  maximumDailyWorkMinutes: number;
  timeZone: string;
};

export type PlanningBlocker = {
  endsAt: UtcIsoDateTime;
  id: string;
  kind: BlockingPeriodKindValue;
  startsAt: UtcIsoDateTime;
};

export type PlanPreviewSession = {
  endsAt: UtcIsoDateTime;
  localDate: LocalDate;
  missionId: string;
  priority: MissionPriority;
  sessionIndex: number;
  startsAt: UtcIsoDateTime;
  title: string;
};

export type PlanPreviewUnscheduledMission = {
  missionId: string;
  reason: UnscheduledReason;
  title: string;
};

export type MyWeekPlanPreview = {
  scheduled: PlanPreviewSession[];
  timeZone: string;
  unscheduled: PlanPreviewUnscheduledMission[];
};

export function buildMyWeekPlanPreview({
  blockers,
  now,
  settings,
  week,
}: {
  blockers: PlanningBlocker[];
  now: Date;
  settings: PlanningSettings;
  week: MyWeekReadModel;
}): MyWeekPlanPreview {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new RangeError("Plan preview requires a valid current instant");
  }

  const workWindows = week.days.flatMap((day) => {
    if (!day.workHours.enabled) {
      return [];
    }

    const startsAt = fromLocalDateTime(
      day.localDate,
      day.workHours.startsAt,
      settings.timeZone,
    );
    const endsAt = fromLocalDateTime(
      day.localDate,
      day.workHours.endsAt,
      settings.timeZone,
    );
    const effectiveStartMs = Math.max(startsAt.getTime(), nowMs);

    if (effectiveStartMs >= endsAt.getTime()) {
      return [];
    }

    return [
      {
        endsAt: endsAt.toISOString(),
        localDate: day.localDate,
        startsAt: new Date(effectiveStartMs).toISOString(),
      },
    ];
  });
  const missions = week.days.flatMap((day) => day.missions);
  const missionsById = new Map(missions.map((mission) => [mission.id, mission]));
  const committedScheduledMinutesByDate = blockers.reduce<
    Partial<Record<LocalDate, number>>
  >((minutesByDate, blocker) => {
    if (
      blocker.kind === BlockingPeriodKind.UNAVAILABLE ||
      blocker.kind === BlockingPeriodKind.OTHER
    ) {
      return minutesByDate;
    }

    const localDate = toLocalDate(blocker.startsAt, settings.timeZone);
    const durationMinutes = Math.max(
      0,
      Math.ceil(
        (Date.parse(blocker.endsAt) - Date.parse(blocker.startsAt)) / 60_000,
      ),
    );
    minutesByDate[localDate] =
      (minutesByDate[localDate] ?? 0) + durationMinutes;
    return minutesByDate;
  }, {});
  const result = planMissions({
    blockingPeriods: blockers.map((blocker) => ({
      ...blocker,
      bufferAfterMinutes: settings.bufferAfterMinutes,
      bufferBeforeMinutes: settings.bufferBeforeMinutes,
    })),
    candidates: missions.map((mission) => ({
      createdAt: mission.createdAt,
      estimatedDurationMinutes: mission.estimatedDurationMinutes,
      locked: false,
      missionId: mission.id,
      occurrenceId: `preview:${mission.id}`,
      priority: mission.priority,
      rescheduleCount: 0,
      schedule: {
        date: mission.selectedDate,
        mode: SchedulingMode.SELECTED_DATE,
      },
      splitPolicy: { splittable: false },
      title: mission.title,
    })),
    now: now.toISOString(),
    preferences: {
      committedMissionMinutesByDate: committedScheduledMinutesByDate,
      maximumDailyMissionMinutes: settings.maximumDailyWorkMinutes,
      missionBufferMinutes: Math.max(
        settings.bufferBeforeMinutes,
        settings.bufferAfterMinutes,
      ),
    },
    workWindows,
  });

  return {
    scheduled: result.scheduled.flatMap((mission) => {
      const source = missionsById.get(mission.missionId);
      if (!source) {
        throw new Error(`Missing preview source mission ${mission.missionId}`);
      }

      return mission.sessions.map((session) => ({
        endsAt: session.endsAt,
        localDate: session.localDate,
        missionId: mission.missionId,
        priority: source.priority,
        sessionIndex: session.sessionIndex,
        startsAt: session.startsAt,
        title: source.title,
      }));
    }),
    timeZone: settings.timeZone,
    unscheduled: result.unscheduled.map((mission) => {
      const source = missionsById.get(mission.missionId);
      if (!source) {
        throw new Error(`Missing preview source mission ${mission.missionId}`);
      }

      return {
        missionId: mission.missionId,
        reason: mission.reason,
        title: source.title,
      };
    }),
  };
}
