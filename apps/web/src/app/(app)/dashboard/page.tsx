import type { Metadata } from "next";

import { DashboardWorkspace } from "@/features/dashboard/dashboard-workspace";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardWorkspace />;
}
