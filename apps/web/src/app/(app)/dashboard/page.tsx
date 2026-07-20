import type { Metadata } from "next";

import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <PageStub href="/dashboard" />;
}
