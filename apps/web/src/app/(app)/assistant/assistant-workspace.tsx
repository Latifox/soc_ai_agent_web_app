"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, MessageSquare, Plus, ShieldCheck, X } from "lucide-react";

import { AssistantChat, type ArgusContext } from "./assistant-chat";
import { StatusLabel, WorkspaceTitle } from "@/components/soc/flagship-ui";
import { Button } from "@/components/ui/button";

interface ThreadSummary {
  id: string;
  title: string;
  message_count: number;
  updated_at?: string;
  context?: { kind: string; id: string; title: string } | null;
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function AssistantWorkspace({ context }: { context?: ArgusContext }) {
  const router = useRouter();
  const [chatKey, setChatKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);

  useEffect(() => {
    if (!showHistory) return;
    fetch("/api/backend/assistant/conversations")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setThreads(d as ThreadSummary[]))
      .catch(() => setThreads([]));
  }, [showHistory, chatKey]);

  const active = context ? `${context.kind === "incident" ? "Incident" : "Case"}: ${context.title}` : "New investigation thread";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-5">
      <WorkspaceTitle
        eyebrow="Argus autonomous SOC"
        title="AI Assistant"
        description={`Investigate alerts, explain attack paths, draft detections, and approve response actions. Current thread: ${active}.`}
        actions={
          <>
            <StatusLabel tone="green"><ShieldCheck className="mr-1 size-3" /> Tenant scoped</StatusLabel>
            <Button size="sm" variant={showHistory ? "primary" : "secondary"} onClick={() => setShowHistory((v) => !v)}><History /> History</Button>
            <Button size="sm" variant="primary" onClick={() => { setChatKey((v) => v + 1); router.push("/assistant"); }}><Plus /> New thread</Button>
          </>
        }
      />
      {showHistory ? (
        <div className="mx-4 mt-4 rounded-card border border-border bg-surface lg:mx-5">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Saved Argus threads</h2>
            <Button size="icon" variant="ghost" aria-label="Close history" onClick={() => setShowHistory(false)}><X /></Button>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {threads.length === 0 ? <p className="col-span-full px-1 py-4 text-sm text-muted-foreground">No saved threads yet — start an investigation.</p> : null}
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.context?.kind === "incident") router.push(`/assistant?incident=${t.context.id}`);
                  else if (t.context?.kind === "case") router.push(`/assistant?case=${t.context.id}`);
                  setShowHistory(false);
                }}
                className="flex flex-col gap-1 rounded-control border border-border px-3 py-2 text-left hover:bg-muted"
              >
                <span className="truncate text-sm font-medium">{t.title}</span>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground"><MessageSquare className="size-3" /> {t.message_count} · {timeAgo(t.updated_at)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="px-4 pt-4 lg:px-5"><AssistantChat key={`${chatKey}-${context?.id ?? "new"}`} context={context} /></div>
    </div>
  );
}
