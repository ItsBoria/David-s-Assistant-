import { AlertCircle, CalendarDays, Clock3, Inbox } from "lucide-react";

import { MissionCreateForm } from "@/components/missions/mission-create-form";
import { MissionItemActions } from "@/components/missions/mission-item-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import type { MissionInboxItem } from "@/lib/repositories/missions";

function formatLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function priorityTone(priority: MissionInboxItem["priority"]) {
  switch (priority) {
    case "urgent":
      return "border-red-200 bg-red-50 text-red-700";
    case "high":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "medium":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "low":
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function priorityLabel(priority: MissionInboxItem["priority"]) {
  const key = {
    high: "mission.priority.high",
    low: "mission.priority.low",
    medium: "mission.priority.medium",
    urgent: "mission.priority.urgent",
  } as const satisfies Record<MissionInboxItem["priority"], Parameters<typeof t>[1]>;

  return t(DEFAULT_LOCALE, key[priority]);
}

function MissionCard({ mission }: { mission: MissionInboxItem }) {
  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-6">
              {mission.title}
            </h3>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityTone(mission.priority)}`}
            >
              {priorityLabel(mission.priority)}
            </span>
          </div>
          {mission.description ? (
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {mission.description}
            </p>
          ) : null}
          {mission.category ? (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              {mission.category}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-sm text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--muted)] px-3 py-1">
            <Clock3 aria-hidden="true" className="size-3.5" />
            {t(DEFAULT_LOCALE, "mission.inbox.durationMinutes", {
              minutes: mission.estimatedDurationMinutes,
            })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--muted)] px-3 py-1">
            <CalendarDays aria-hidden="true" className="size-3.5" />
            {t(DEFAULT_LOCALE, "mission.inbox.targetDate", {
              date: formatLocalDate(mission.selectedDate),
            })}
          </span>
        </div>
      </div>
      <MissionItemActions mission={mission} />
    </li>
  );
}

export function MissionInboxView({
  loadError,
  missions,
}: {
  loadError?: "unavailable" | null;
  missions: MissionInboxItem[];
}) {
  return (
    <div className="space-y-6">
      {loadError ? (
        <div
          className="flex items-start gap-3 rounded-2xl border border-[var(--destructive)]/20 bg-[var(--destructive-soft)] px-4 py-3 text-sm leading-6 text-[var(--destructive)]"
          role="alert"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {t(DEFAULT_LOCALE, "mission.inbox.loadErrorTitle")}
            </p>
            <p>{t(DEFAULT_LOCALE, "mission.inbox.loadErrorDescription")}</p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{t(DEFAULT_LOCALE, "mission.inbox.pageTitle")}</CardTitle>
            <CardDescription>
              {t(DEFAULT_LOCALE, "mission.inbox.pageDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {missions.length > 0 ? (
              <ul className="space-y-3">
                {missions.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} />
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/40 p-8 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--surface)] text-[var(--muted-foreground)] shadow-sm">
                  <Inbox aria-hidden="true" className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">
                  {t(DEFAULT_LOCALE, "mission.inbox.emptyTitle")}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">
                  {t(DEFAULT_LOCALE, "mission.inbox.emptyDescription")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(DEFAULT_LOCALE, "mission.inbox.formTitle")}</CardTitle>
            <CardDescription>
              {t(DEFAULT_LOCALE, "mission.inbox.formDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MissionCreateForm />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
