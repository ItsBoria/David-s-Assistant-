import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { authCopy } from "@/components/auth/copy";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t(DEFAULT_LOCALE, "auth.signup.submit"),
};

export default function SignUpPage() {
  return (
    <AuthShell
      description={authCopy.signUp.description}
      eyebrow={authCopy.signUp.eyebrow}
      footer={
        <>
          {authCopy.signUp.hasAccount}{" "}
          <Link
            className="font-semibold text-[var(--primary)] underline-offset-4 hover:underline"
            href="/login"
          >
            {authCopy.signUp.signIn}
          </Link>
        </>
      }
      title={authCopy.signUp.title}
    >
      <SignUpForm />
    </AuthShell>
  );
}
