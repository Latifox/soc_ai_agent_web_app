import type { Metadata } from "next";

import { SettingsWorkspace } from "@/features/workspaces/settings-workspace";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsWorkspace />;
}
