import { Clock3 } from "lucide-react";

import { WorkHoursForm } from "@/components/settings/work-hours-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import type { WorkHoursSchedule } from "@/lib/repositories/work-hours";

export function SettingsView({
  schedule,
}: {
  schedule: WorkHoursSchedule;
}) {
  return (
    <section aria-labelledby="settings-heading" className="space-y-6">
      <div className="max-w-2xl space-y-2">
        <h2
          className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
          id="settings-heading"
        >
          {t(DEFAULT_LOCALE, "settings.pageTitle")}
        </h2>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          {t(DEFAULT_LOCALE, "settings.pageDescription")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="mb-3 grid size-11 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <Clock3 aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>{t(DEFAULT_LOCALE, "settings.workHours.title")}</CardTitle>
          <CardDescription>
            {t(DEFAULT_LOCALE, "settings.workHours.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkHoursForm schedule={schedule} />
        </CardContent>
      </Card>
    </section>
  );
}
