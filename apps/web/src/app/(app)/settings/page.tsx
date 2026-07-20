import type { Metadata } from "next";

import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <PageStub href="/settings" />;
}
