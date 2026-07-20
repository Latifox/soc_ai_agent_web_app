import type { Metadata } from "next";

import { InvestigationWorkspace } from "@/features/investigations/investigation-workspace";

export const metadata: Metadata = { title: "Investigations" };

export default function InvestigationsPage() {
  return <InvestigationWorkspace />;
}
