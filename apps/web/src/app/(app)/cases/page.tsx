import type { Metadata } from "next";

import { CasesWorkspace } from "@/features/cases/cases-workspace";
import { getCases } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Cases" };

export default async function CasesPage() {
  const cases = await getCases();
  const open = cases.filter((c) => c.status === "open").length;
  const inProgress = cases.filter((c) => c.status === "in_progress").length;
  const closed = cases.filter((c) => c.status === "closed").length;
  const strip: WorkspaceMetric[] = [
    { label: "Total cases", value: String(cases.length), detail: `${open} open`, tone: "violet" },
    { label: "In progress", value: String(inProgress), detail: "being worked", tone: inProgress ? "amber" : "green" },
    { label: "Closed", value: String(closed), detail: "resolved", tone: "green" },
    { label: "Comments", value: String(cases.reduce((n, c) => n + (c.comments?.length ?? 0), 0)), detail: "across cases", tone: "violet" },
  ];
  return <CasesWorkspace cases={cases} metrics={strip} />;
}
