import type { Metadata } from "next";

import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Investigations" };

export default function InvestigationsPage() {
  return <PageStub href="/investigations" />;
}
