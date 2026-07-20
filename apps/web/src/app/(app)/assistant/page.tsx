import type { Metadata } from "next";

import { AssistantWorkspace } from "./assistant-workspace";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AssistantPage() {
  return <AssistantWorkspace />;
}
