import type { Metadata } from "next";

import { ReportsWorkspace } from "@/features/workspaces/reports-workspace";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return <ReportsWorkspace />;
}
