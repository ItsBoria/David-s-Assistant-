import { describe, expect, it } from "vitest";

import {
  AuthValidationMessage,
  localizeAuthValidationMessage,
  passwordSchema,
  signInSchema,
  signUpSchema,
  zodErrorToFieldErrors,
} from "../../src/lib/validation";

describe("authentication validation", () => {
  it("normalizes email input while preserving passwords", () => {
    const result = signInSchema.parse({
      email: "  DAVID@Example.COM ",
      password: "  exact password  ",
    });

    expect(result).toEqual({
      email: "david@example.com",
      password: "  exact password  ",
    });
  });

  it("rejects an invalid email and blank sign-in password", () => {
    const result = signInSchema.safeParse({ email: "not-an-email", password: "" });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(zodErrorToFieldErrors(result.error)).toEqual({
        email: [AuthValidationMessage.EMAIL_INVALID],
        password: [AuthValidationMessage.PASSWORD_REQUIRED],
      });
    }
  });

  it("enforces password boundaries for new credentials", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("correct horse battery staple").success).toBe(
      true,
    );
    expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);
  });

  it("reports a confirmation mismatch on the confirmation field", () => {
    const result = signUpSchema.safeParse({
      email: "david@example.com",
      password: "a secure password",
      confirmPassword: "a different password",
      fullName: "  David   Cohen  ",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(zodErrorToFieldErrors(result.error).confirmPassword).toContain(
        AuthValidationMessage.PASSWORD_MISMATCH,
      );
    }
  });

  it("requires and normalizes a full name after successful validation", () => {
    const result = signUpSchema.parse({
      email: "david@example.com",
      password: "a secure password",
      confirmPassword: "a secure password",
      fullName: "  David   Cohen  ",
    });

    expect(result.fullName).toBe("David Cohen");
    expect(
      signUpSchema.safeParse({
        email: "david@example.com",
        password: "a secure password",
        confirmPassword: "a secure password",
        fullName: "",
      }).success,
    ).toBe(false);
  });

  it("localizes schema messages without rewriting server messages", () => {
    expect(
      localizeAuthValidationMessage(
        "he",
        AuthValidationMessage.EMAIL_INVALID,
      ),
    ).toBe("הזינו כתובת אימייל תקינה.");
    expect(localizeAuthValidationMessage("en", "Account is locked")).toBe(
      "Account is locked",
    );
  });
});
