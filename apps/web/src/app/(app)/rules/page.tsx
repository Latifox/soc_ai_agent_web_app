import type { Metadata } from "next";

import { RulesWorkspace } from "@/features/rules/rules-workspace";
import { getMetrics, getRules } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Rules" };

export default async function RulesPage() {
  const [rules, metrics] = await Promise.all([getRules(), getMetrics()]);
  const strip: WorkspaceMetric[] = [
    { label: "Total rules", value: String(metrics.rules.total), detail: `${metrics.rules.enabled} enabled`, tone: "violet" },
    { label: "MITRE techniques", value: String(metrics.rules.mitre_techniques.length), detail: "covered", tone: "green" },
    { label: "Deployed", value: String(rules.filter((r) => r.integration).length), detail: "on integrations", tone: "amber" },
    { label: "Disabled", value: String(rules.filter((r) => !r.enabled).length), detail: "not running", tone: rules.some((r) => !r.enabled) ? "red" : "green" },
  ];
  return <RulesWorkspace rules={rules} metrics={strip} />;
}
