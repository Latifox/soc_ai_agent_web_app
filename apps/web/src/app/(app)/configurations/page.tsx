import type { Metadata } from "next";

import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Configurations" };

export default function ConfigurationsPage() {
  return <PageStub href="/configurations" />;
}
