import { z } from "zod";

import {
  t,
  type AppLocale,
  type TranslationKey,
} from "../i18n";

export const AuthValidationMessage = {
  EMAIL_REQUIRED: "validation.email.required",
  EMAIL_INVALID: "validation.email.invalid",
  EMAIL_TOO_LONG: "validation.email.tooLong",
  PASSWORD_REQUIRED: "validation.password.required",
  PASSWORD_TOO_SHORT: "validation.password.tooShort",
  PASSWORD_TOO_LONG: "validation.password.tooLong",
  PASSWORD_MISMATCH: "validation.password.mismatch",
  FULL_NAME_REQUIRED: "validation.fullName.required",
  FULL_NAME_TOO_SHORT: "validation.fullName.tooShort",
  FULL_NAME_TOO_LONG: "validation.fullName.tooLong",
} as const satisfies Record<string, TranslationKey>;

const authValidationMessages = new Set<string>(
  Object.values(AuthValidationMessage),
);

/** Localizes a schema message while leaving non-schema server messages intact. */
export function localizeAuthValidationMessage(
  locale: AppLocale | string,
  message: string | undefined,
): string | undefined {
  if (!message || !authValidationMessages.has(message)) {
    return message;
  }

  return t(locale, message as TranslationKey);
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: AuthValidationMessage.EMAIL_REQUIRED })
  .max(254, { message: AuthValidationMessage.EMAIL_TOO_LONG })
  .email({ message: AuthValidationMessage.EMAIL_INVALID })
  .transform((email) => email.toLowerCase());

/** Password policy used when creating or replacing credentials. */
export const passwordSchema = z
  .string()
  .min(1, { message: AuthValidationMessage.PASSWORD_REQUIRED })
  .min(8, { message: AuthValidationMessage.PASSWORD_TOO_SHORT })
  .max(128, { message: AuthValidationMessage.PASSWORD_TOO_LONG });

/** Sign-in accepts an existing password without applying the newer length floor. */
export const signInPasswordSchema = z
  .string()
  .min(1, { message: AuthValidationMessage.PASSWORD_REQUIRED })
  .max(128, { message: AuthValidationMessage.PASSWORD_TOO_LONG });

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, { message: AuthValidationMessage.FULL_NAME_REQUIRED })
  .min(2, { message: AuthValidationMessage.FULL_NAME_TOO_SHORT })
  .max(100, { message: AuthValidationMessage.FULL_NAME_TOO_LONG })
  .transform((name) => name.replace(/\s+/g, " "));

export const signInSchema = z.object({
  email: emailSchema,
  password: signInPasswordSchema,
});

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, {
      message: AuthValidationMessage.PASSWORD_REQUIRED,
    }),
    fullName: fullNameSchema,
  })
  .superRefine(({ password, confirmPassword }, context) => {
    if (password !== confirmPassword) {
      context.addIssue({
        code: "custom",
        message: AuthValidationMessage.PASSWORD_MISMATCH,
        path: ["confirmPassword"],
      });
    }
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, {
      message: AuthValidationMessage.PASSWORD_REQUIRED,
    }),
  })
  .superRefine(({ password, confirmPassword }, context) => {
    if (password !== confirmPassword) {
      context.addIssue({
        code: "custom",
        message: AuthValidationMessage.PASSWORD_MISMATCH,
        path: ["confirmPassword"],
      });
    }
  });

export type SignInInput = z.output<typeof signInSchema>;
export type SignInFormValues = z.input<typeof signInSchema>;
export type SignUpInput = z.output<typeof signUpSchema>;
export type SignUpFormValues = z.input<typeof signUpSchema>;
export type ForgotPasswordInput = z.output<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.output<typeof resetPasswordSchema>;
