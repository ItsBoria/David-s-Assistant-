import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { authCopy } from "@/components/auth/copy";
import { LoginForm } from "@/components/auth/login-form";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t(DEFAULT_LOCALE, "auth.login.submit"),
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthShell
      description={authCopy.login.description}
      eyebrow={authCopy.login.eyebrow}
      footer={
        <>
          {authCopy.login.noAccount}{" "}
          <Link
            className="font-semibold text-[var(--primary)] underline-offset-4 hover:underline"
            href="/sign-up"
          >
            {authCopy.login.createAccount}
          </Link>
        </>
      }
      title={authCopy.login.title}
    >
      <LoginForm nextPath={next} />
    </AuthShell>
  );
}
