import type { ZodError } from "zod";

/** Maps Zod issues into the public AppErrorResponse field-error shape. */
export function zodErrorToFieldErrors(
  error: ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "_form";
    (fieldErrors[field] ??= []).push(issue.message);
  }

  return fieldErrors;
}
