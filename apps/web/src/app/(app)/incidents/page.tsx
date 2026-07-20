import type { Metadata } from "next";

import { InvestigationWorkspace } from "@/features/investigations/investigation-workspace";

export const metadata: Metadata = { title: "Incidents" };

export default function IncidentsPage() {
  return <InvestigationWorkspace />;
}
