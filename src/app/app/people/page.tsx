import type { Metadata } from "next";

import { appNavigation } from "@/components/app-shell/config";
import { FoundationView } from "@/components/foundation/foundation-view";

export const metadata: Metadata = { title: appNavigation[2].label };

export default function PeopleAndMeetingsPage() {
  return <FoundationView {...appNavigation[2]} />;
}
