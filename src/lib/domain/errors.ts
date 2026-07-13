export const AppErrorCode = {
  VALIDATION_ERROR: "validation_error",
  AUTHENTICATION_REQUIRED: "authentication_required",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  CONFLICT: "conflict",
  RATE_LIMITED: "rate_limited",
  EXPIRED: "expired",
  EXTERNAL_SERVICE_ERROR: "external_service_error",
  INTERNAL_ERROR: "internal_error",
} as const;

export type AppErrorCode =
  (typeof AppErrorCode)[keyof typeof AppErrorCode];

/** Safe, serializable error returned by server actions and route handlers. */
export interface AppErrorResponse {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  retryable?: boolean;
}

interface ErrorResponseOptions {
  fieldErrors?: Record<string, readonly string[]>;
  retryable?: boolean;
}

export function createAppErrorResponse(
  code: AppErrorCode | string,
  message: string,
  options: ErrorResponseOptions = {},
): AppErrorResponse {
  const response: AppErrorResponse = { code, message };

  if (options.fieldErrors) {
    response.fieldErrors = Object.fromEntries(
      Object.entries(options.fieldErrors).map(([field, errors]) => [
        field,
        [...errors],
      ]),
    );
  }

  if (options.retryable !== undefined) {
    response.retryable = options.retryable;
  }

  return response;
}

export function isAppErrorResponse(value: unknown): value is AppErrorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AppErrorResponse>;
  if (typeof candidate.code !== "string" || typeof candidate.message !== "string") {
    return false;
  }

  if (
    candidate.retryable !== undefined &&
    typeof candidate.retryable !== "boolean"
  ) {
    return false;
  }

  if (candidate.fieldErrors === undefined) {
    return true;
  }

  return (
    candidate.fieldErrors !== null &&
    typeof candidate.fieldErrors === "object" &&
    Object.values(candidate.fieldErrors).every(
      (errors) =>
        Array.isArray(errors) &&
        errors.every((error) => typeof error === "string"),
    )
  );
}
