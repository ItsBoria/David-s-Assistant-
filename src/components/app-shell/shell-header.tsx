"use client";

import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

import { getActiveNavigationItem, shellCopy } from "./config";

export function ShellHeader() {
  const pathname = usePathname();
  const current = getActiveNavigationItem(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/92 px-5 py-4 backdrop-blur sm:px-8 md:px-10 lg:px-12">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
            {current.label}
          </h1>
          <p className="mt-0.5 hidden truncate text-xs text-[var(--muted-foreground)] sm:block">
            {current.description}
          </p>
        </div>

        <form action={signOut}>
          <Button
            aria-label={shellCopy.signOut}
            className="md:hidden"
            size="icon"
            title={shellCopy.signOut}
            type="submit"
            variant="ghost"
          >
            <LogOut aria-hidden="true" className="size-[18px]" />
          </Button>
        </form>
      </div>
    </header>
  );
}
