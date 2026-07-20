import type { Metadata } from "next";

import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Incidents" };

export default function IncidentsPage() {
  return <PageStub href="/incidents" />;
}
