import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RuleEditor } from "@/features/rules/rule-editor";
import { ApiError, getIntegrations, getRule } from "@/lib/api";

export const metadata: Metadata = { title: "Rule" };

export default async function RuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [rule, integrations] = await Promise.all([getRule(id), getIntegrations()]);
    return <RuleEditor rule={rule} integrations={integrations} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
