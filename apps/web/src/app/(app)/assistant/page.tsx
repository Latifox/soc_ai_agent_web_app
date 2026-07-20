import type { Metadata } from "next";
import { History, Plus, ShieldCheck } from "lucide-react";

import { AssistantChat } from "./assistant-chat";
import { StatusLabel, WorkspaceTitle } from "@/components/soc/flagship-ui";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AssistantPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-5">
      <WorkspaceTitle
        eyebrow="Argus autonomous SOC"
        title="AI Assistant"
        description="Investigate alerts, explain attack paths, draft detections, and approve response actions in one governed workspace."
        actions={
          <>
            <StatusLabel tone="green"><ShieldCheck className="mr-1 size-3" /> Tenant scoped</StatusLabel>
            <Button size="sm" variant="secondary"><History /> History</Button>
            <Button size="sm" variant="primary"><Plus /> New thread</Button>
          </>
        }
      />
      <div className="px-4 pt-4 lg:px-5"><AssistantChat /></div>
    </div>
  );
}
