import type { Metadata } from "next";

import { AssistantChat } from "./assistant-chat";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AssistantPage() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask Argus to explain an alert, investigate an incident, or draft a detection rule.
        </p>
      </div>
      <AssistantChat />
    </div>
  );
}
