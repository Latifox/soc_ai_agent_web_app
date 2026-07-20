"use client";

import { useState } from "react";
import { History, Plus, ShieldCheck, X } from "lucide-react";

import { AssistantChat } from "./assistant-chat";
import { StatusLabel, WorkspaceTitle } from "@/components/soc/flagship-ui";
import { Button } from "@/components/ui/button";

const threads = [
  "INC-2026-0720-0001 attack path",
  "Suspicious LSASS rule draft",
  "Pending response approvals",
];

export function AssistantWorkspace() {
  const [chatKey, setChatKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [activeThread, setActiveThread] = useState(threads[0]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-5">
      <WorkspaceTitle
        eyebrow="Argus autonomous SOC"
        title="AI Assistant"
        description={`Investigate alerts, explain attack paths, draft detections, and approve response actions. Current thread: ${activeThread}.`}
        actions={
          <>
            <StatusLabel tone="green"><ShieldCheck className="mr-1 size-3" /> Tenant scoped</StatusLabel>
            <Button size="sm" variant={showHistory ? "primary" : "secondary"} onClick={() => setShowHistory((value) => !value)}><History /> History</Button>
            <Button size="sm" variant="primary" onClick={() => { setChatKey((value) => value + 1); setActiveThread("New investigation thread"); }}><Plus /> New thread</Button>
          </>
        }
      />
      {showHistory ? (
        <div className="mx-4 mt-4 rounded-card border border-border bg-surface lg:mx-5">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Recent Argus threads</h2>
            <Button size="icon" variant="ghost" aria-label="Close history" onClick={() => setShowHistory(false)}><X /></Button>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-3">
            {threads.map((thread) => (
              <button key={thread} type="button" onClick={() => { setActiveThread(thread); setShowHistory(false); }} className="rounded-control border border-border px-3 py-2 text-left text-sm hover:bg-muted">
                {thread}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="px-4 pt-4 lg:px-5"><AssistantChat key={`${chatKey}-${activeThread}`} /></div>
    </div>
  );
}
