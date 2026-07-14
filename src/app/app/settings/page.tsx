import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appNavigation } from "@/components/app-shell/config";
import { SettingsView } from "@/components/settings/settings-view";
import { getWorkHoursSettings } from "@/lib/services/work-hours";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: appNavigation[3].label };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;

  if (error || typeof ownerId !== "string") {
    redirect("/login?next=/app/settings");
  }

  const schedule = await getWorkHoursSettings({ ownerId, supabase });

  return <SettingsView schedule={schedule} />;
}
