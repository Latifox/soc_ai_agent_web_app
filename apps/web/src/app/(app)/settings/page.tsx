import type { Metadata } from "next";

import { SettingsWorkspace } from "@/features/settings/settings-workspace";
import { getAutonomyPolicies, getIntegrations, getWhoami } from "@/lib/api";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [who, policies, integrations] = await Promise.all([getWhoami(), getAutonomyPolicies(), getIntegrations()]);
  const connected = integrations.filter((i) => i.status === "connected").length;
  return <SettingsWorkspace who={who} policies={policies} connectedSources={connected} />;
}
