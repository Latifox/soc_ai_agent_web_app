import type { Metadata } from "next";

import { ReportsWorkspace } from "@/features/reports/reports-workspace";
import { getMetrics, getReports } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const [reports, metrics] = await Promise.all([getReports(), getMetrics()]);
  const strip: WorkspaceMetric[] = [
    { label: "Reports", value: String(reports.length), detail: "generated", tone: "violet" },
    { label: "Open incidents", value: String(metrics.incidents.open), detail: `${metrics.incidents.total} total`, tone: metrics.incidents.open ? "red" : "green" },
    { label: "MITRE coverage", value: String(metrics.rules.mitre_techniques.length), detail: "techniques", tone: "green" },
    { label: "Cases", value: String(metrics.cases.total), detail: `${metrics.cases.open} open`, tone: "amber" },
  ];
  return <ReportsWorkspace reports={reports} metrics={strip} />;
}
