import type { Metadata } from "next";

import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Automation" };

export default function AutomationPage() {
  return <PageStub href="/automation" />;
}
