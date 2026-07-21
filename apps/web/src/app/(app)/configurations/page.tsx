import type { Metadata } from "next";

import { ConfigurationsWorkspace } from "@/features/configurations/configurations-workspace";
import { getAutonomyPolicies, getIntegrations, getMetrics, getWhoami } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Configurations" };

export default async function ConfigurationsPage() {
  const [metrics, integrations, policies, who] = await Promise.all([getMetrics(), getIntegrations(), getAutonomyPolicies(), getWhoami()]);
  const strip: WorkspaceMetric[] = [
    { label: "Connected sources", value: String(metrics.integrations.connected), detail: `${metrics.integrations.total} total`, tone: metrics.integrations.connected ? "green" : "amber" },
    { label: "Enabled rules", value: String(metrics.rules.enabled), detail: `${metrics.rules.total} total`, tone: "violet" },
    { label: "MITRE coverage", value: String(metrics.rules.mitre_techniques.length), detail: "techniques", tone: "green" },
    { label: "Connector issues", value: String(metrics.integrations.issues), detail: "need attention", tone: metrics.integrations.issues ? "red" : "green" },
  ];
  return <ConfigurationsWorkspace metrics={metrics} integrations={integrations} policies={policies} tenantId={who.tenant_id} strip={strip} />;
}
