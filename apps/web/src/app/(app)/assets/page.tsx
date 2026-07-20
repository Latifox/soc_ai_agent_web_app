import type { Metadata } from "next";

import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Assets" };

export default function AssetsPage() {
  return <PageStub href="/assets" />;
}
