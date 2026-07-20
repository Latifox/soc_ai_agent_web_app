import type { Metadata } from "next";

import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Rules" };

export default function RulesPage() {
  return <PageStub href="/rules" />;
}
