import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

function claimString(claims: Record<string, unknown>, key: string) {
  return typeof claims[key] === "string" ? claims[key] : undefined;
}

function userDisplayName(claims: Record<string, unknown>, email: string) {
  const metadata = claims.user_metadata;

  if (metadata && typeof metadata === "object") {
    const fullName = (metadata as Record<string, unknown>).full_name;

    if (typeof fullName === "string" && fullName.trim()) {
      return fullName.trim();
    }
  }

  return email.split("@")[0] || t(DEFAULT_LOCALE, "shell.userFallback");
}

export default async function ProtectedAppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login?next=/app");
  }

  const claims = data.claims as Record<string, unknown>;
  const email =
    claimString(claims, "email") ??
    t(DEFAULT_LOCALE, "shell.accountFallback");

  return (
    <AppShell user={{ displayName: userDisplayName(claims, email), email }}>
      {children}
    </AppShell>
  );
}
