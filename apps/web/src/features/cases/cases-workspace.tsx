"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Folder, Loader2, MessageSquare, Plus, Search, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricStrip, StatusLabel, WorkspaceTitle } from "@/components/soc/flagship-ui";
import { cn } from "@/lib/utils";
import type { CaseRecord } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

const STATUSES = ["all", "open", "in_progress", "closed"] as const;

function statusTone(s: string) {
  return s === "closed" ? ("green" as const) : s === "in_progress" ? ("amber" as const) : ("violet" as const);
}
function titleCase(s: string) {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function timeAgo(iso?: string) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.status === 204 ? null : resp.json();
}

export function CasesWorkspace({ cases: initial, metrics }: { cases: CaseRecord[]; metrics: WorkspaceMetric[] }) {
  const router = useRouter();
  const [cases, setCases] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", tags: "" });
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      const matchesQ = q ? [c.title, c.description ?? "", ...(c.tags ?? [])].some((v) => v.toLowerCase().includes(q)) : true;
      return matchesQ && (status === "all" || c.status === status);
    });
  }, [cases, query, status]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = (await backend("cases", {
        method: "POST",
        body: JSON.stringify({ title: draft.title || "Untitled case", description: draft.description, tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean) }),
      })) as CaseRecord;
      setCases((c) => [created, ...c]);
      setDrawer(false);
      setDraft({ title: "", description: "", tags: "" });
      router.push(`/cases/${created.id}`);
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle
        eyebrow="Investigations"
        title="Cases"
        description="Investigation containers grouping incidents, evidence, and analyst collaboration."
        actions={<Button size="sm" variant="primary" onClick={() => setDrawer(true)}><Plus /> New case</Button>}
      />
      <MetricStrip metrics={metrics} />

      <div className="space-y-4 p-4 lg:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search cases</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cases..." className="h-10 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary/50" />
          </label>
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-control border px-3 py-2 text-xs capitalize", status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {s === "all" ? "All" : titleCase(s)}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <button key={c.id} type="button" onClick={() => router.push(`/cases/${c.id}`)} className="soc-panel flex flex-col gap-3 p-4 text-left transition hover:border-primary/40">
              <div className="flex items-start justify-between gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"><Folder className="size-4" /></span>
                <StatusLabel tone={statusTone(c.status)}>{titleCase(c.status)}</StatusLabel>
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{c.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description || "No description."}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(c.tags ?? []).slice(0, 3).map((t) => <span key={t} className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>)}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><User className="size-3.5" /> {c.assignee ?? "Unassigned"}</span>
                <span className="flex items-center gap-2"><span className="flex items-center gap-1"><MessageSquare className="size-3.5" /> {c.comments?.length ?? 0}</span>{timeAgo(c.updated_at ?? c.created_at)}</span>
              </div>
            </button>
          ))}
          {filtered.length === 0 ? <div className="soc-panel col-span-full py-12 text-center text-sm text-muted-foreground">No cases match your filters.</div> : null}
        </div>
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="ml-auto flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">New case</h2>
              <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setDrawer(false)}><X /></Button>
            </div>
            <form onSubmit={submit} className="flex flex-1 flex-col gap-4 p-4">
              <label className="space-y-1 text-sm"><span className="soc-label">Title</span>
                <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" /></label>
              <label className="space-y-1 text-sm"><span className="soc-label">Description</span>
                <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={4} className="w-full resize-y rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary" /></label>
              <label className="space-y-1 text-sm"><span className="soc-label">Tags (comma-separated)</span>
                <input value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" /></label>
              <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-4">
                <Button size="sm" variant="secondary" onClick={() => setDrawer(false)}>Cancel</Button>
                <Button size="sm" variant="primary" type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus />} Create</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
