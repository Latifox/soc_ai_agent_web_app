import type { Metadata } from "next";

import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Cases" };

export default function CasesPage() {
  return <PageStub href="/cases" />;
}
