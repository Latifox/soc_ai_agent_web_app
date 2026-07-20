import type { Metadata } from "next";

import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return <PageStub href="/integrations" />;
}
