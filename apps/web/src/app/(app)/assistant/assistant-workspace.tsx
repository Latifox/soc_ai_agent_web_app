"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Search, ShieldCheck, Sparkles } from "lucide-react";

import { AssistantChat, type ArgusContext } from "./assistant-chat";
import { StatusLabel } from "@/components/soc/flagship-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThreadSummary {
  id: string;
  title: string;
  message_count: number;
  updated_at?: string;
  context?: { kind: string; id: string; title: string } | null;
}

type LoadedMsg = { role: "user" | "assistant"; content: string };

function timeAgo(iso?: string) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}

export function AssistantWorkspace({ context }: { context?: ArgusContext }) {
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const activeKey = context ? `${context.kind}-${context.id}` : "";

  // The thread currently loaded into the chat (id = stored thread key, plus its messages).
  const [active, setActive] = useState<{ id: string; title: string; messages: LoadedMsg[] } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/backend/assistant/conversations")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setThreads(d as ThreadSummary[]))
      .catch(() => setThreads([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = threads.filter((t) => (query ? t.title.toLowerCase().includes(query.toLowerCase()) : true));

  async function openThread(t: ThreadSummary) {
    // Incident/case threads carry a generative context card — load them via the routed page.
    if (t.context?.kind === "incident") { router.push(`/assistant?incident=${t.context.id}`); return; }
    if (t.context?.kind === "case") { router.push(`/assistant?case=${t.context.id}`); return; }
    // Plain threads: fetch the saved messages and load them into the chat in place.
    setLoadingId(t.id);
    try {
      const convo = await fetch(`/api/backend/assistant/conversations/${t.id}`).then((r) => (r.ok ? r.json() : null));
      const messages = (convo?.messages ?? []).filter((m: LoadedMsg) => m.role === "user" || m.role === "assistant") as LoadedMsg[];
      setActive({ id: t.id, title: t.title, messages });
      if (window.location.search) router.replace("/assistant");
    } catch {
      setActive(null);
    } finally {
      setLoadingId(null);
    }
  }

  function newThread() {
    setActive(null);
    if (window.location.search) router.replace("/assistant");
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-background">
      {/* History side panel */}
      <aside className={cn("flex shrink-0 flex-col border-r border-border bg-surface-subtle/30 transition-[width] duration-200", open ? "w-72" : "w-0 overflow-hidden")}>
        <div className="flex items-center gap-2 border-b border-border p-3">
          <span className="flex size-8 items-center justify-center rounded-control bg-primary/10 text-primary"><Sparkles className="size-4" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Argus threads</p><p className="text-[10px] text-muted-foreground">Saved in Supabase</p></div>
        </div>
        <div className="p-3">
          <Button size="sm" variant="primary" className="w-full justify-center" onClick={newThread}><Plus /> New thread</Button>
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search threads" className="h-8 w-full rounded-control border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary/50" />
          </label>
        </div>
        <div className="soc-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">No saved threads yet.</p> : null}
          {filtered.map((t) => {
            const isActive = active?.id === t.id || (Boolean(t.context) && `${t.context!.kind}-${t.context!.id}` === activeKey);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => openThread(t)}
                className={cn("flex w-full flex-col gap-0.5 rounded-control border px-2.5 py-2 text-left transition", isActive ? "border-primary/50 bg-primary/[0.06]" : "border-transparent hover:border-border hover:bg-muted/50")}
              >
                <span className="truncate text-sm font-medium">{t.title}</span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  {loadingId === t.id ? <Loader2 className="size-3 animate-spin" /> : <MessageSquare className="size-3" />} {t.message_count} · {timeAgo(t.updated_at)} ago
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <Button size="icon" variant="ghost" aria-label={open ? "Hide history" : "Show history"} onClick={() => setOpen((v) => !v)}>{open ? <PanelLeftClose /> : <PanelLeftOpen />}</Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{context ? `${context.kind === "incident" ? "Incident" : "Case"}: ${context.title}` : active ? active.title : "AI Assistant"}</p>
            <p className="text-[11px] text-muted-foreground">Argus autonomous SOC · generative UI</p>
          </div>
          <StatusLabel tone="green"><ShieldCheck className="mr-1 size-3" /> Tenant scoped</StatusLabel>
        </div>
        <div className="min-h-0 flex-1 p-3 lg:p-4">
          <AssistantChat
            key={active?.id ?? context?.id ?? "new"}
            context={context}
            initialMessages={active?.messages}
            threadKey={active?.id}
            onSaved={refresh}
          />
        </div>
      </div>
    </div>
  );
}
