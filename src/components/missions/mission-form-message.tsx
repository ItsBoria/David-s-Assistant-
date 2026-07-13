import { AlertCircle, CheckCircle2 } from "lucide-react";

import { DEFAULT_LOCALE } from "@/lib/i18n";
import { localizeMissionValidationMessage } from "@/lib/validation/mission";

function displayMessage(message?: string) {
  return localizeMissionValidationMessage(DEFAULT_LOCALE, message);
}

export function MissionFormMessage({
  id,
  message,
  tone = "error",
}: {
  id: string;
  message?: string;
  tone?: "error" | "success";
}) {
  const localizedMessage = displayMessage(message);

  if (!localizedMessage) {
    return null;
  }

  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <p
      className={
        tone === "success"
          ? "flex items-start gap-2 rounded-xl bg-[var(--success-soft)] px-3.5 py-3 text-sm leading-5 text-[var(--success)]"
          : "flex items-start gap-2 rounded-xl bg-[var(--destructive-soft)] px-3.5 py-3 text-sm leading-5 text-[var(--destructive)]"
      }
      id={id}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {localizedMessage}
    </p>
  );
}

export function MissionFieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
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
