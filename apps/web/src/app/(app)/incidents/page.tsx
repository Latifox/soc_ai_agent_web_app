import type { Metadata } from "next";

import { InvestigationWorkspace } from "@/features/investigations/investigation-workspace";
import { liveInvestigation } from "@/lib/live-data";

export const metadata: Metadata = { title: "Incidents" };

export default async function IncidentsPage() {
  const { queue, timelines, details, mitre } = await liveInvestigation();
  return <InvestigationWorkspace queue={queue} timelines={timelines} details={details} mitre={mitre} />;
}
