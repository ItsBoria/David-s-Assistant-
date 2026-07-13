import { AlertCircle } from "lucide-react";

import { DEFAULT_LOCALE } from "@/lib/i18n";
import { localizeAuthValidationMessage } from "@/lib/validation/auth";

function displayMessage(message?: string) {
  return localizeAuthValidationMessage(DEFAULT_LOCALE, message);
}

export function FormMessage({ id, message }: { id: string; message?: string }) {
  const localizedMessage = displayMessage(message);

  if (!localizedMessage) {
    return null;
  }

  return (
    <p
      className="flex items-start gap-2 rounded-xl bg-[var(--destructive-soft)] px-3.5 py-3 text-sm leading-5 text-[var(--destructive)]"
      id={id}
      role="alert"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {localizedMessage}
    </p>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  const localizedMessage = displayMessage(message);

  if (!localizedMessage) {
    return null;
  }

  return (
    <p className="text-xs text-[var(--destructive)]" id={id} role="alert">
      {localizedMessage}
    </p>
  );
}
