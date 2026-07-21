import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CaseDetail } from "@/features/cases/case-detail";
import { ApiError, getCase } from "@/lib/api";

export const metadata: Metadata = { title: "Case" };

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const c = await getCase(id);
    return <CaseDetail case={c} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
