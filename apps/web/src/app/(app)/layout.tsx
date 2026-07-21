import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { getAgentsStatus, getApprovals, getWhoami } from "@/lib/api";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const who = await getWhoami();
  // First-run: an authenticated user with no resolved tenant (fresh signup, no workspace yet)
  // is sent to onboarding to create their tenant + connect OpenSearch.
  if (who.tenant_id === "—") redirect("/onboarding");

  const [agents, approvals] = await Promise.all([getAgentsStatus(), getApprovals()]);
  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <AppHeader who={who} operational={agents.operational} pendingApprovals={pendingApprovals} />
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
