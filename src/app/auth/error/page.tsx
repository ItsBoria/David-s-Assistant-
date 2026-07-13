import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: t(DEFAULT_LOCALE, "auth.error.metadataTitle"),
};

const messages: Record<string, string> = {
  confirmation_failed: t(DEFAULT_LOCALE, "auth.error.confirmationFailed"),
  invalid_callback: t(DEFAULT_LOCALE, "auth.error.invalidCallback"),
  signout_failed: t(DEFAULT_LOCALE, "auth.error.signOutFailed"),
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message =
    messages[reason ?? ""] ??
    t(DEFAULT_LOCALE, "auth.error.generic");
  const signOutFailed = reason === "signout_failed";

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[var(--destructive-soft)] text-[var(--destructive)]">
            <AlertCircle aria-hidden="true" className="size-5" />
          </span>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {t(DEFAULT_LOCALE, "auth.error.heading")}
            </h1>
            <p className="text-sm leading-6 text-[var(--muted-foreground)]">
              {message}
            </p>
          </div>
          <Link
            className={cn(buttonVariants(), "w-full")}
            href={signOutFailed ? "/app" : "/login"}
          >
            {signOutFailed
              ? t(DEFAULT_LOCALE, "auth.error.returnToWorkspace")
              : t(DEFAULT_LOCALE, "auth.error.returnToSignIn")}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
