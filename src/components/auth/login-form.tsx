"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { signInWithPassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInSchema,
  type SignInInput,
} from "@/lib/validation/auth";
import { getSafeInternalPath } from "@/lib/security/safe-redirect";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";

import { authCopy } from "./copy";
import { FieldError, FormMessage } from "./form-message";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<SignInInput>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);

    try {
      const result = await signInWithPassword(values);

      if (!result.ok) {
        setServerError(result.message);
        return;
      }

      router.replace(getSafeInternalPath(nextPath));
      router.refresh();
    } catch {
      setServerError(t(DEFAULT_LOCALE, "auth.error.unavailable"));
    }
  });

  return (
    <form aria-describedby="login-form-error" className="space-y-5" noValidate onSubmit={onSubmit}>
      <FormMessage id="login-form-error" message={serverError} />

      <div className="space-y-2">
        <Label htmlFor="email">{t(DEFAULT_LOCALE, "auth.email.label")}</Label>
        <Input
          aria-describedby={errors.email ? "email-error" : undefined}
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          autoFocus
          id="email"
          inputMode="email"
          placeholder={t(DEFAULT_LOCALE, "auth.email.placeholder")}
          type="email"
          {...register("email")}
        />
        <FieldError id="email-error" message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">
          {t(DEFAULT_LOCALE, "auth.password.label")}
        </Label>
        <Input
          aria-describedby={errors.password ? "password-error" : undefined}
          aria-invalid={Boolean(errors.password)}
          autoComplete="current-password"
          id="password"
          type="password"
          {...register("password")}
        />
        <FieldError id="password-error" message={errors.password?.message} />
      </div>

      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ArrowRight aria-hidden="true" className="size-4" />
        )}
        {isSubmitting ? authCopy.login.submitting : authCopy.login.submit}
      </Button>
    </form>
  );
}
