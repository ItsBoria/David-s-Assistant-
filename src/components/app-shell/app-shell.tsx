import type { ReactNode } from "react";
import { CalendarCheck2, LogOut } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

import { shellCopy } from "./config";
import { DesktopNavigation, MobileNavigation } from "./navigation";
import { ShellHeader } from "./shell-header";

export type ShellUser = {
  displayName: string;
  email: string;
};

function initials(name: string) {
  const value = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase())
    .join("");

  return value || "U";
}

export function AppShell({ children, user }: { children: ReactNode; user: ShellUser }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <a
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2"
        href="#main-content"
      >
        {shellCopy.skipToContent}
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-[var(--border)] bg-[var(--surface)] md:flex">
        <div className="flex h-[76px] items-center gap-3 px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
            <CalendarCheck2 aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">
              {shellCopy.brandName}
            </span>
            <span className="block text-xs text-[var(--muted-foreground)]">
              {shellCopy.brandQualifier}
            </span>
          </span>
        </div>

        <DesktopNavigation />

        <div className="mt-auto border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-3">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]"
            >
              {initials(user.displayName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {user.displayName}
              </span>
              <span className="block truncate text-xs text-[var(--muted-foreground)]">
                {user.email}
              </span>
            </span>
          </div>
          <form action={signOut}>
            <Button className="w-full justify-start" type="submit" variant="ghost">
              <LogOut aria-hidden="true" className="size-4" />
              {shellCopy.signOut}
            </Button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 md:col-start-2">
        <ShellHeader />
        <main
          className="mx-auto w-full max-w-6xl px-5 pb-28 pt-8 outline-none sm:px-8 md:px-10 md:pb-12 md:pt-10 lg:px-12"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      <MobileNavigation />
    </div>
  );
}
