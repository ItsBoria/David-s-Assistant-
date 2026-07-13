import type { ReactNode } from "react";
import { CalendarCheck2, Check } from "lucide-react";

import { authCopy } from "./copy";

export function AuthShell({
  children,
  description,
  eyebrow,
  footer,
  title,
}: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  footer: ReactNode;
  title: string;
}) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,0.9fr)_minmax(560px,1.1fr)]">
      <section className="relative hidden overflow-hidden border-r border-[var(--border)] bg-[#eaf0eb] p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
            <CalendarCheck2 aria-hidden="true" className="size-5" />
          </span>
          {authCopy.brand.name}
        </div>

        <div className="max-w-lg space-y-8 pb-10">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              {authCopy.brand.eyebrow}
            </p>
            <p className="text-4xl font-semibold leading-tight tracking-[-0.035em] text-[#253329] xl:text-5xl">
              {authCopy.brand.promise}
            </p>
          </div>
          <ul className="grid gap-3 text-sm text-[#566259]" role="list">
            {authCopy.brand.benefits.map((item) => (
              <li className="flex items-center gap-3" key={item}>
                <span className="grid size-6 place-items-center rounded-full bg-white/80 text-[var(--primary)]">
                  <Check aria-hidden="true" className="size-3.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-[#566259]">
          {authCopy.brand.securityFootnote}
        </p>
      </section>

      <section className="flex min-h-dvh items-center justify-center bg-[var(--surface-subtle)] px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 text-sm font-semibold lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
              <CalendarCheck2 aria-hidden="true" className="size-5" />
            </span>
            {authCopy.brand.name}
          </div>

          <div className="mb-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              {eyebrow}
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">
              {description}
            </p>
          </div>

          {children}
          <div className="mt-7 text-center text-sm text-[var(--muted-foreground)]">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
