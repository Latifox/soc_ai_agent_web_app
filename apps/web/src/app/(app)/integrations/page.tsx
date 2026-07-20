import type { Metadata } from "next";

import { IntegrationsWorkspace } from "@/features/workspaces/integrations-workspace";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return <IntegrationsWorkspace />;
}
