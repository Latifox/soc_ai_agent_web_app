import type { Metadata } from "next";

import { DashboardWorkspace } from "@/features/dashboard/dashboard-workspace";
import { liveDashboard } from "@/lib/live-data";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { metrics, queue, attention, agents, details, pendingApprovals, telemetry } = await liveDashboard();
  return (
    <DashboardWorkspace
      metrics={metrics}
      queue={queue}
      attention={attention}
      agents={agents}
      details={details}
      pendingApprovals={pendingApprovals}
      telemetry={telemetry}
    />
  );
}
