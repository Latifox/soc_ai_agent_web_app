import type { Metadata } from "next";

import { RulesWorkspace } from "@/features/workspaces/rules-workspace";

export const metadata: Metadata = { title: "Rules" };

export default function RulesPage() {
  return <RulesWorkspace />;
}
