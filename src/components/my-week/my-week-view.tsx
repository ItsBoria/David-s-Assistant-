import { AlertTriangle, CalendarDays, Clock3, Inbox, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AcceptPlanButton } from "@/components/my-week/accept-plan-button";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import { DateOverrideKind } from "@/lib/domain/work-schedule";
import type { MyWeekDay, MyWeekReadModel } from "@/lib/my-week/read-model";
import type { MyWeekPlanPreview } from "@/lib/planning/read-model";
import { UnscheduledReason } from "@/lib/scheduling";

const weekdayLabels = {
  0: "weekday.sunday",
  1: "weekday.monday",
  2: "weekday.tuesday",
  3: "weekday.wednesday",
  4: "weekday.thursday",
} as const satisfies Record<MyWeekDay["weekday"], Parameters<typeof t>[1]>;

function formatLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatInstantTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

const unscheduledReasonLabels = {
  [UnscheduledReason.DEADLINE_PASSED]: "myWeek.plan.reason.deadlinePassed",
  [UnscheduledReason.NO_ALLOWED_DAY]: "myWeek.plan.reason.noAllowedDay",
  [UnscheduledReason.NO_AVAILABLE_WORK_HOURS]:
    "myWeek.plan.reason.noAvailableHours",
  [UnscheduledReason.FIXED_TIME_CONFLICT]:
    "myWeek.plan.reason.fixedConflict",
  [UnscheduledReason.DURATION_CANNOT_FIT]:
    "myWeek.plan.reason.durationCannotFit",
  [UnscheduledReason.MINIMUM_SESSION_DURATION_CANNOT_FIT]:
    "myWeek.plan.reason.minimumSessionCannotFit",
  [UnscheduledReason.MAXIMUM_DAILY_MISSION_MINUTES_REACHED]:
    "myWeek.plan.reason.dailyLimitReached",
  [UnscheduledReason.LOCKED_MISSION_HAS_NO_PRESERVED_SESSION]:
    "myWeek.plan.reason.lockedMission",
} as const;

function PlanPreview({ preview }: { preview: MyWeekPlanPreview }) {
  return (
    <Card className="overflow-hidden border-[var(--primary)]/25">
      <CardHeader className="border-b border-[var(--border)] bg-[var(--primary-soft)]/55">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-3 grid size-11 place-items-center rounded-xl bg-[var(--primary)] text-white">
              <Sparkles aria-hidden="true" className="size-5" />
            </div>
            <CardTitle>{t(DEFAULT_LOCALE, "myWeek.plan.title")}</CardTitle>
            <CardDescription>
              {t(DEFAULT_LOCALE, "myWeek.plan.description")}
            </CardDescription>
          </div>
          <span className="rounded-full border border-[var(--primary)]/20 bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
            {t(DEFAULT_LOCALE, "myWeek.plan.previewOnly")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        {preview.savedSessions.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold">
              {t(DEFAULT_LOCALE, "myWeek.plan.savedTitle")}
            </h3>
            <ol className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {preview.savedSessions.map((session) => (
                <li
                  className="rounded-xl border border-[var(--success)]/25 bg-[var(--success-soft)] p-4"
                  key={session.id}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--success)]">
                    {formatLocalDate(session.localDate)} ·{" "}
                    {formatInstantTime(session.startsAt, preview.timeZone)}–
                    {formatInstantTime(session.endsAt, preview.timeZone)}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{session.title}</p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {preview.scheduled.length > 0 ? (
          <div className="space-y-4">
            <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {preview.scheduled.map((session) => (
                <li
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                  key={`${session.missionId}:${session.sessionIndex}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
                    {formatLocalDate(session.localDate)} ·{" "}
                    {formatInstantTime(session.startsAt, preview.timeZone)}–
                    {formatInstantTime(session.endsAt, preview.timeZone)}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{session.title}</p>
                </li>
              ))}
            </ol>
            <AcceptPlanButton
              expectedPlan={preview.scheduled.map((session) => ({
                endsAt: session.endsAt,
                missionId: session.missionId,
                startsAt: session.startsAt,
              }))}
            />
          </div>
        ) : (
          preview.savedSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-4 text-sm text-[var(--muted-foreground)]">
              {t(DEFAULT_LOCALE, "myWeek.plan.empty")}
            </div>
          ) : null
        )}

        {preview.unscheduled.length > 0 ? (
          <div className="rounded-xl border border-[var(--destructive)]/25 bg-[var(--destructive-soft)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle
                aria-hidden="true"
                className="size-4 text-[var(--destructive)]"
              />
              {t(DEFAULT_LOCALE, "myWeek.plan.unscheduledTitle")}
            </div>
            <ul className="mt-3 space-y-2">
              {preview.unscheduled.map((mission) => (
                <li className="text-sm" key={mission.missionId}>
                  <span className="font-medium">{mission.title}</span>
                  <span className="text-[var(--muted-foreground)]">
                    {" — "}
                    {t(DEFAULT_LOCALE, unscheduledReasonLabels[mission.reason])}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WorkHoursBadge({ day }: { day: MyWeekDay }) {
  if (day.overrideKind === DateOverrideKind.DAY_OFF) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
        <Clock3 aria-hidden="true" className="size-3.5" />
        {t(DEFAULT_LOCALE, "myWeek.dayOff")}
      </span>
    );
  }

  if (!day.workHours.enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
        <Clock3 aria-hidden="true" className="size-3.5" />
        {t(DEFAULT_LOCALE, "myWeek.noWorkHours")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
      <Clock3 aria-hidden="true" className="size-3.5" />
      {t(
        DEFAULT_LOCALE,
        day.overrideKind === DateOverrideKind.CUSTOM_HOURS
          ? "myWeek.customHours"
          : "myWeek.workHours",
        {
          endsAt: day.workHours.endsAt,
          startsAt: day.workHours.startsAt,
        },
      )}
    </span>
  );
}

function WeekDayCard({ day }: { day: MyWeekDay }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">
              {t(DEFAULT_LOCALE, weekdayLabels[day.weekday])}
            </CardTitle>
            <CardDescription>{formatLocalDate(day.localDate)}</CardDescription>
            {day.overrideReason ? (
              <p className="mt-1 max-w-52 text-xs leading-5 text-[var(--muted-foreground)]">
                {day.overrideReason}
              </p>
            ) : null}
          </div>
          <WorkHoursBadge day={day} />
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {day.missions.length > 0 ? (
          <ul className="space-y-2">
            {day.missions.map((mission) => (
              <li
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                key={mission.id}
              >
                <p className="text-sm font-semibold">{mission.title}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {t(DEFAULT_LOCALE, "myWeek.missionDuration", {
                    minutes: mission.estimatedDurationMinutes,
                  })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-4 text-sm text-[var(--muted-foreground)]">
            {t(DEFAULT_LOCALE, "myWeek.noMissions")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MyWeekView({
  planPreview,
  week,
}: {
  planPreview: MyWeekPlanPreview;
  week: MyWeekReadModel;
}) {
  const missionCount = week.days.reduce(
    (total, day) => total + day.missions.length,
    0,
  );

  return (
    <section aria-labelledby="my-week-heading" className="space-y-6">
      <div className="max-w-3xl space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--primary)]">
          <CalendarDays aria-hidden="true" className="size-3.5" />
          {t(DEFAULT_LOCALE, "myWeek.weekRange", {
            endsOn: formatLocalDate(week.endsOn),
            startsOn: formatLocalDate(week.startsOn),
          })}
        </div>
        <h2
          className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
          id="my-week-heading"
        >
          {t(DEFAULT_LOCALE, "myWeek.pageTitle")}
        </h2>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          {t(DEFAULT_LOCALE, "myWeek.pageDescription")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="mb-3 grid size-11 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <Inbox aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>{t(DEFAULT_LOCALE, "myWeek.summaryTitle")}</CardTitle>
          <CardDescription>
            {t(DEFAULT_LOCALE, "myWeek.summaryDescription", {
              count: missionCount,
            })}
          </CardDescription>
        </CardHeader>
      </Card>

      <PlanPreview preview={planPreview} />

      <div className="grid gap-4 xl:grid-cols-5">
        {week.days.map((day) => (
          <WeekDayCard day={day} key={day.localDate} />
        ))}
      </div>
    </section>
  );
}
