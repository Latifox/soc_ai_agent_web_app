import type { Metadata } from "next";

import { ConfigurationsWorkspace } from "@/features/workspaces/configurations-workspace";

export const metadata: Metadata = { title: "Configurations" };

export default function ConfigurationsPage() {
  return <ConfigurationsWorkspace />;
}
