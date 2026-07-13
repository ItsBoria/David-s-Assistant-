import type { Metadata } from "next";

import { appNavigation } from "@/components/app-shell/config";
import { FoundationView } from "@/components/foundation/foundation-view";

export const metadata: Metadata = { title: appNavigation[1].label };

export default function MissionInboxPage() {
  return <FoundationView {...appNavigation[1]} />;
}
