"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { appNavigation, getActiveNavigationItem, shellCopy } from "./config";

export function DesktopNavigation() {
  const pathname = usePathname();
  const activeItem = getActiveNavigationItem(pathname);

  return (
    <nav aria-label={shellCopy.navigationLabel} className="grid gap-1 px-3">
      {appNavigation.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === activeItem.href;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              isActive &&
                "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]",
            )}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" className="size-[18px] shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  const activeItem = getActiveNavigationItem(pathname);

  return (
    <nav
      aria-label={shellCopy.navigationLabel}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-4">
        {appNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === activeItem.href;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium text-[var(--muted-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                isActive && "bg-[var(--primary-soft)] text-[var(--primary)]",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" className="size-[18px]" />
              <span className="max-w-full truncate">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
