import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appNavigation } from "@/components/app-shell/config";
import { MissionInboxView } from "@/components/missions/mission-inbox-view";
import { getMissionInbox } from "@/lib/services/missions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: appNavigation[1].label };

export default async function MissionInboxPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;

  if (error || typeof ownerId !== "string") {
    redirect("/login?next=/app/inbox");
  }

  const missions = await getMissionInbox({ ownerId, supabase });

  return <MissionInboxView missions={missions} />;
}
