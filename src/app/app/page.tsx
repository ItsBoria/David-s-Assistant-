import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { appNavigation } from "@/components/app-shell/config";
import { MyWeekView } from "@/components/my-week/my-week-view";
import { getMyWeekReadModel } from "@/lib/services/my-week";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: appNavigation[0].label };

export default async function MyWeekPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;

  if (error || typeof ownerId !== "string") {
    redirect("/login?next=/app");
  }

  const week = await getMyWeekReadModel({ ownerId, supabase });

  return <MyWeekView week={week} />;
}
