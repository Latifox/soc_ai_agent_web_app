import type { Metadata } from "next";

import { CasesWorkspace } from "@/features/workspaces/cases-workspace";

export const metadata: Metadata = { title: "Cases" };

export default function CasesPage() {
  return <CasesWorkspace />;
}
