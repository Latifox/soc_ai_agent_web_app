import type { Metadata } from "next";

import { AssetsWorkspace, type AssetView } from "@/features/assets/assets-workspace";
import { getAssets, getDiscoveredAssets, getIncidents, type AssetRecord } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Assets" };

const CRIT_WEIGHT: Record<string, number> = { low: 10, normal: 25, high: 45, critical: 60 };
const SEV_WEIGHT: Record<string, number> = { info: 3, low: 6, medium: 12, high: 20, critical: 30 };

export default async function AssetsPage() {
  const [manual, discovered, incidents] = await Promise.all([getAssets(), getDiscoveredAssets(), getIncidents()]);

  // Merge OpenSearch-discovered devices (live from logs) with the manually curated inventory.
  // Manual records win on collision (they carry human-set criticality/attributes).
  const byName = new Map<string, AssetRecord>();
  for (const a of discovered.assets) byName.set(a.name.toLowerCase(), a);
  for (const a of manual) {
    const key = a.name.toLowerCase();
    const found = byName.get(key);
    byName.set(key, found ? { ...found, ...a, attributes: { ...found.attributes, ...a.attributes } } : a);
  }

  const enriched: AssetView[] = [...byName.values()].map((a) => {
    const related = incidents
      .filter((i) => (i.entities ?? []).some((e) => e.toLowerCase() === a.name.toLowerCase()))
      .map((i) => ({ id: i.id, title: i.title, severity: i.severity }));
    // Live risk: OpenSearch/criticality base + incident pressure, capped at 100.
    const base = a.discovered ? a.risk_score : (CRIT_WEIGHT[a.criticality] ?? 20);
    const risk = Math.min(100, base + related.reduce((n, i) => n + (SEV_WEIGHT[i.severity] ?? 6), 0));
    return { id: a.id, kind: a.kind, name: a.name, criticality: a.criticality, attributes: a.attributes ?? {}, incidents: related, risk, discovered: Boolean(a.discovered) };
  });
  enriched.sort((a, b) => b.risk - a.risk);

  const highRisk = enriched.filter((a) => a.risk >= 70).length;
  const fromLogs = enriched.filter((a) => a.discovered).length;
  const withIncidents = enriched.filter((a) => a.incidents.length > 0).length;
  const strip: WorkspaceMetric[] = [
    { label: "Total assets", value: String(enriched.length), detail: `${fromLogs} from OpenSearch`, tone: "violet" },
    { label: "High risk", value: String(highRisk), detail: "risk ≥ 70", tone: highRisk ? "red" : "green" },
    { label: "Under attack", value: String(withIncidents), detail: "linked to incidents", tone: withIncidents ? "amber" : "green" },
    { label: "Hosts", value: String(enriched.filter((a) => a.kind === "host").length), detail: "in inventory", tone: "violet" },
  ];

  return <AssetsWorkspace assets={enriched} metrics={strip} discoveryAvailable={discovered.available} discoveryReason={discovered.reason} />;
}
