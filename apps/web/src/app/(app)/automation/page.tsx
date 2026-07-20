import type { Metadata } from "next";

import { AutomationWorkspace } from "@/features/workspaces/automation-workspace";

export const metadata: Metadata = { title: "Automation" };

export default function AutomationPage() {
  return <AutomationWorkspace />;
}
