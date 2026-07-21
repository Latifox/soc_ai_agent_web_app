import type { Metadata } from "next";

import { AssetsWorkspace, type AssetView } from "@/features/assets/assets-workspace";
import { getAssets, getIncidents } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Assets" };

const CRIT_WEIGHT: Record<string, number> = { low: 10, normal: 25, high: 45, critical: 60 };
const SEV_WEIGHT: Record<string, number> = { info: 3, low: 6, medium: 12, high: 20, critical: 30 };

export default async function AssetsPage() {
  const [assets, incidents] = await Promise.all([getAssets(), getIncidents()]);

  const enriched: AssetView[] = assets.map((a) => {
    const related = incidents
      .filter((i) => (i.entities ?? []).some((e) => e.toLowerCase() === a.name.toLowerCase()))
      .map((i) => ({ id: i.id, title: i.title, severity: i.severity }));
    // Live risk: base criticality + incident pressure, capped at 100.
    const risk = Math.min(100, (CRIT_WEIGHT[a.criticality] ?? 20) + related.reduce((n, i) => n + (SEV_WEIGHT[i.severity] ?? 6), 0));
    return { id: a.id, kind: a.kind, name: a.name, criticality: a.criticality, attributes: a.attributes ?? {}, incidents: related, risk };
  });

  const highRisk = enriched.filter((a) => a.risk >= 70).length;
  const crit = enriched.filter((a) => a.criticality === "critical" || a.criticality === "high").length;
  const withIncidents = enriched.filter((a) => a.incidents.length > 0).length;
  const strip: WorkspaceMetric[] = [
    { label: "Total assets", value: String(enriched.length), detail: `${crit} high-criticality`, tone: "violet" },
    { label: "High risk", value: String(highRisk), detail: "risk ≥ 70", tone: highRisk ? "red" : "green" },
    { label: "Under attack", value: String(withIncidents), detail: "linked to incidents", tone: withIncidents ? "amber" : "green" },
    { label: "Hosts", value: String(enriched.filter((a) => a.kind === "host").length), detail: "in inventory", tone: "violet" },
  ];

  return <AssetsWorkspace assets={enriched} metrics={strip} />;
}
