import { CalendarDays, Clock3, Inbox } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import { DateOverrideKind } from "@/lib/domain/work-schedule";
import type { MyWeekDay, MyWeekReadModel } from "@/lib/my-week/read-model";

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

export function MyWeekView({ week }: { week: MyWeekReadModel }) {
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

      <div className="grid gap-4 xl:grid-cols-5">
        {week.days.map((day) => (
          <WeekDayCard day={day} key={day.localDate} />
        ))}
      </div>
    </section>
  );
}
