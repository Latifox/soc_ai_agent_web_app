import type { Metadata } from "next";

import { IncidentsList } from "@/features/incidents/incidents-list";
import { getIncidents, getMetrics, getRules } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Incidents" };

export default async function IncidentsPage() {
  const [incidents, rules, metrics] = await Promise.all([getIncidents(), getRules(), getMetrics()]);
  // Each incident is raised by a rule; surface that rule's target integration as its source.
  const ruleByTitle = new Map(rules.map((r) => [r.title, r]));
  const enriched = incidents.map((i) => ({
    ...i,
    source: i.rule_title ? ruleByTitle.get(i.rule_title)?.integration ?? null : null,
  }));

  const strip: WorkspaceMetric[] = [
    { label: "Open", value: String(metrics.incidents.open), detail: `${metrics.incidents.total} total`, tone: metrics.incidents.open ? "red" : "green" },
    { label: "Critical / High", value: `${metrics.incidents.by_severity.critical ?? 0} / ${metrics.incidents.by_severity.high ?? 0}`, detail: "open severity", tone: "amber" },
    { label: "In progress", value: String(metrics.incidents.by_status.in_progress ?? 0), detail: "being worked", tone: "violet" },
    { label: "Resolved", value: String(metrics.incidents.by_status.resolved ?? 0), detail: "closed out", tone: "green" },
  ];
  return <IncidentsList incidents={enriched} metrics={strip} />;
}
