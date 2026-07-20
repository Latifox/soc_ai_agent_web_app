import type { Metadata } from "next";

import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return <PageStub href="/reports" />;
}
