import type { Metadata } from "next";

import { AutomationWorkspace } from "@/features/automation/automation-workspace";
import { getAgentsStatus, getApprovals, getAutonomyPolicies } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Automation" };

export default async function AutomationPage() {
  const [policies, approvals, agentsResp] = await Promise.all([getAutonomyPolicies(), getApprovals(), getAgentsStatus()]);
  const pending = approvals.filter((a) => a.status === "pending").length;
  const auto = policies.filter((p) => p.mode === "auto").length;
  const denied = policies.filter((p) => p.mode === "deny").length;
  const strip: WorkspaceMetric[] = [
    { label: "Pending approvals", value: String(pending), detail: "awaiting a human", tone: pending ? "red" : "green" },
    { label: "Auto-allowed", value: String(auto), detail: "action classes", tone: "violet" },
    { label: "Denied", value: String(denied), detail: "blocked outright", tone: denied ? "amber" : "green" },
    { label: "Crew", value: agentsResp.operational ? "Operational" : "Offline", detail: `${agentsResp.agents.length} agents`, tone: agentsResp.operational ? "green" : "amber" },
  ];
  return <AutomationWorkspace policies={policies} approvals={approvals} agents={agentsResp.agents} metrics={strip} />;
}
