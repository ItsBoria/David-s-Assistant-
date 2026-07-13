"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { signUpWithPassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signUpSchema,
  type SignUpInput,
} from "@/lib/validation/auth";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";

import { authCopy } from "./copy";
import { FieldError, FormMessage } from "./form-message";

export function SignUpForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [confirmationSent, setConfirmationSent] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<SignUpInput>({
    defaultValues: {
      confirmPassword: "",
      email: "",
      fullName: "",
      password: "",
    },
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);

    try {
      const result = await signUpWithPassword(values);

      if (!result.ok) {
        setServerError(result.message);
        return;
      }

      if (result.requiresEmailConfirmation) {
        setConfirmationSent(true);
        return;
      }

      router.replace("/app");
      router.refresh();
    } catch {
      setServerError(t(DEFAULT_LOCALE, "auth.error.unavailable"));
    }
  });

  if (confirmationSent) {
    return (
      <div
        aria-live="polite"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]"
      >
        <span className="mb-4 grid size-11 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
          <CheckCircle2 aria-hidden="true" className="size-5" />
        </span>
        <h2 className="text-lg font-semibold">
          {authCopy.signUp.confirmationTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          {authCopy.signUp.confirmationDescription}
        </p>
        <Link
          className="mt-5 inline-flex text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline"
          href="/login"
        >
          {authCopy.signUp.returnToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form aria-describedby="sign-up-form-error" className="space-y-5" noValidate onSubmit={onSubmit}>
      <FormMessage id="sign-up-form-error" message={serverError} />

      <div className="space-y-2">
        <Label htmlFor="fullName">
          {t(DEFAULT_LOCALE, "auth.fullName.label")}
        </Label>
        <Input
          aria-describedby={errors.fullName ? "full-name-error" : undefined}
          aria-invalid={Boolean(errors.fullName)}
          autoComplete="name"
          autoFocus
          id="fullName"
          placeholder={authCopy.signUp.fullNamePlaceholder}
          {...register("fullName")}
        />
        <FieldError id="full-name-error" message={errors.fullName?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t(DEFAULT_LOCALE, "auth.email.label")}</Label>
        <Input
          aria-describedby={errors.email ? "email-error" : undefined}
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          id="email"
          inputMode="email"
          placeholder={t(DEFAULT_LOCALE, "auth.email.placeholder")}
          type="email"
          {...register("email")}
        />
        <FieldError id="email-error" message={errors.email?.message} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">
            {t(DEFAULT_LOCALE, "auth.password.label")}
          </Label>
          <Input
            aria-describedby={errors.password ? "password-error" : undefined}
            aria-invalid={Boolean(errors.password)}
            autoComplete="new-password"
            id="password"
            type="password"
            {...register("password")}
          />
          <FieldError id="password-error" message={errors.password?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">
            {t(DEFAULT_LOCALE, "auth.confirmPassword.label")}
          </Label>
          <Input
            aria-describedby={
              errors.confirmPassword ? "confirm-password-error" : undefined
            }
            aria-invalid={Boolean(errors.confirmPassword)}
            autoComplete="new-password"
            id="confirmPassword"
            type="password"
            {...register("confirmPassword")}
          />
          <FieldError
            id="confirm-password-error"
            message={errors.confirmPassword?.message}
          />
        </div>
      </div>

      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ArrowRight aria-hidden="true" className="size-4" />
        )}
        {isSubmitting ? authCopy.signUp.submitting : authCopy.signUp.submit}
      </Button>
    </form>
  );
}
