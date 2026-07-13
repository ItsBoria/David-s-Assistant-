import { CircleCheck, type LucideIcon } from "lucide-react";

import type { AppNavigationItem } from "@/components/app-shell/config";
import { shellCopy } from "@/components/app-shell/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function FoundationView({
  description,
  emptyDescription,
  emptyTitle,
  icon: Icon,
  label,
}: Pick<
  AppNavigationItem,
  "description" | "emptyDescription" | "emptyTitle" | "icon" | "label"
> & { icon: LucideIcon }) {
  return (
    <section aria-labelledby="foundation-heading" className="space-y-6">
      <div className="max-w-2xl space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--primary)]">
          <CircleCheck aria-hidden="true" className="size-3.5" />
          {shellCopy.foundationBadge}
        </div>
        <h2
          className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
          id="foundation-heading"
        >
          {label}
        </h2>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          {description}
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
          <div className="mb-3 grid size-11 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <Icon aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>{emptyTitle}</CardTitle>
          <CardDescription className="max-w-2xl">
            {emptyDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
            {shellCopy.foundationNote}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
