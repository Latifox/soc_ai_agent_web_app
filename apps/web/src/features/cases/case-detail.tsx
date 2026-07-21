"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, MessageSquare, Send, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, StatusLabel } from "@/components/soc/flagship-ui";
import type { CaseRecord } from "@/lib/api";

const STATUS_OPTIONS = ["open", "in_progress", "closed"] as const;

function statusTone(s: string) {
  return s === "closed" ? ("green" as const) : s === "in_progress" ? ("amber" as const) : ("violet" as const);
}
function titleCase(s: string) {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.status === 204 ? null : resp.json();
}

export function CaseDetail({ case: initial }: { case: CaseRecord }) {
  const router = useRouter();
  const [c, setCase] = useState(initial);
  const [status, setStatus] = useState(initial.status);
  const [assignee, setAssignee] = useState(initial.assignee ?? "");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"" | "status" | "assign" | "comment">("");
  const [notice, setNotice] = useState("");

  async function patch(body: Record<string, unknown>, kind: "status" | "assign") {
    setBusy(kind);
    setNotice("");
    try {
      const updated = (await backend(`cases/${c.id}`, { method: "PATCH", body: JSON.stringify(body) })) as CaseRecord;
      setCase(updated);
      setStatus(updated.status);
      setNotice(kind === "status" ? `Status → ${titleCase(updated.status)}` : `Assigned to ${updated.assignee ?? "Unassigned"}`);
    } catch {
      setNotice("Update failed.");
    } finally {
      setBusy("");
    }
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy("comment");
    try {
      const updated = (await backend(`cases/${c.id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) })) as CaseRecord;
      setCase(updated);
      setComment("");
    } catch {
      setNotice("Comment failed.");
    } finally {
      setBusy("");
    }
  }

  const comments = c.comments ?? [];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-4 lg:px-5">
        <button type="button" aria-label="Back" onClick={() => router.push("/cases")} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="size-5" /></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{c.title}</h1>
            <StatusLabel tone={statusTone(status)}>{titleCase(status)}</StatusLabel>
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">Case ID: {c.id.slice(0, 8)}{c.incident_id ? ` · from incident ${c.incident_id.slice(0, 8)}` : ""}</p>
        </div>
        {c.incident_id ? <Button size="sm" variant="secondary" onClick={() => router.push(`/incidents/${c.incident_id}`)}>View incident <ArrowRight /></Button> : null}
      </div>

      {notice ? <div className="mx-4 mt-4 rounded-control border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary lg:mx-5">{notice}</div> : null}

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] lg:p-5">
        <div className="space-y-4">
          <Panel title="Overview" eyebrow="Case">
            <div className="space-y-4 p-4">
              <p className="text-sm leading-6 text-muted-foreground">{c.description || "No description recorded."}</p>
              {(c.tags ?? []).length ? (
                <div><p className="soc-label mb-1.5">Tags</p><div className="flex flex-wrap gap-1.5">{(c.tags ?? []).map((t) => <span key={t} className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>)}</div></div>
              ) : null}
            </div>
          </Panel>

          <Panel title="Activity" eyebrow="Collaboration" action={<StatusLabel tone="neutral">{comments.length} comments</StatusLabel>}>
            <div className="space-y-3 p-4">
              {comments.length ? comments.map((cm, i) => (
                <div key={i} className="rounded-control border border-border bg-surface-subtle/30 p-3">
                  <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-medium"><span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary">{(cm.author ?? "?").slice(0, 1).toUpperCase()}</span>{cm.author}</span><span className="text-muted-foreground">{fmt(cm.ts)}</span></div>
                  <p className="mt-2 text-sm text-muted-foreground">{cm.body}</p>
                </div>
              )) : <p className="py-4 text-center text-sm text-muted-foreground"><MessageSquare className="mx-auto mb-1 size-5" /> No comments yet.</p>}
              <form onSubmit={addComment} className="flex gap-2 pt-1">
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" className="h-9 flex-1 rounded-control border border-border bg-surface px-3 text-sm outline-none focus:border-primary" />
                <Button size="icon" variant="primary" type="submit" disabled={busy !== "" || !comment.trim()} aria-label="Send">{busy === "comment" ? <Loader2 className="animate-spin" /> : <Send />}</Button>
              </form>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Manage" eyebrow="Update">
            <div className="space-y-4 p-4">
              <div className="space-y-1 text-sm"><span className="soc-label">Status</span>
                <div className="flex gap-2">
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 flex-1 rounded-control border border-border bg-surface px-3 capitalize outline-none focus:border-primary">
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                  </select>
                  <Button size="sm" variant="primary" onClick={() => patch({ status }, "status")} disabled={busy !== "" || status === c.status}>{busy === "status" ? <Loader2 className="animate-spin" /> : "Set"}</Button>
                </div>
              </div>
              <div className="space-y-1 text-sm"><span className="soc-label">Assignee</span>
                <div className="flex gap-2">
                  <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="analyst@org" className="h-9 flex-1 rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" />
                  <Button size="sm" variant="secondary" onClick={() => patch({ assignee }, "assign")} disabled={busy !== ""}>{busy === "assign" ? <Loader2 className="animate-spin" /> : <User />}</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <div><p className="soc-label">Created</p><p className="mt-1">{fmt(c.created_at)}</p></div>
                <div><p className="soc-label">Updated</p><p className="mt-1">{fmt(c.updated_at ?? c.created_at)}</p></div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
