"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validation/auth";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import { getAuthCallbackUrl } from "@/lib/security/app-url";
import { createClient } from "@/lib/supabase/server";

export type AuthActionResult =
  | { ok: false; message: string }
  | { ok: true; requiresEmailConfirmation: boolean };

export async function signInWithPassword(
  input: SignInInput,
): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: t(DEFAULT_LOCALE, "auth.form.validationSummary"),
      ok: false,
    };
  }

  try {
    const supabase = await createClient({ cookieWrites: "required" });
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return {
        message: t(DEFAULT_LOCALE, "auth.error.invalidCredentials"),
        ok: false,
      };
    }

    return { ok: true, requiresEmailConfirmation: false };
  } catch {
    return {
      message: t(DEFAULT_LOCALE, "auth.error.unavailable"),
      ok: false,
    };
  }
}

export async function signUpWithPassword(
  input: SignUpInput,
): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: t(DEFAULT_LOCALE, "auth.form.validationSummary"),
      ok: false,
    };
  }

  try {
    const supabase = await createClient({ cookieWrites: "required" });
    const requestHeaders = await headers();
    const emailRedirectTo = getAuthCallbackUrl({
      configuredUrl: process.env.NEXT_PUBLIC_APP_URL,
      production: process.env.NODE_ENV === "production",
      requestOrigin: requestHeaders.get("origin"),
    });
    const { email, fullName, password } = parsed.data;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
        data: { full_name: fullName },
      },
    });

    if (error) {
      return {
        message: t(DEFAULT_LOCALE, "auth.error.signupFailed"),
        ok: false,
      };
    }

    return {
      ok: true,
      requiresEmailConfirmation: data.session === null,
    };
  } catch {
    return {
      message: t(DEFAULT_LOCALE, "auth.error.unavailable"),
      ok: false,
    };
  }
}

export async function signOut() {
  try {
    const supabase = await createClient({ cookieWrites: "required" });
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  } catch {
    redirect("/auth/error?reason=signout_failed");
  }

  redirect("/login");
}
