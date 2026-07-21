import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { IncidentDetail } from "@/features/incidents/incident-detail";
import { ApiError, getIncident, getRules } from "@/lib/api";

export const metadata: Metadata = { title: "Incident" };

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [incident, rules] = await Promise.all([getIncident(id), getRules()]);
    const rule = incident.rule_title ? rules.find((r) => r.title === incident.rule_title) : undefined;
    return <IncidentDetail incident={{ ...incident, source: rule?.integration ?? null }} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
