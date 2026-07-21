"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock3, Database, FileText, Loader2, Plug, Sparkles, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, SeverityBadge, StatusLabel, type Severity } from "@/components/soc/flagship-ui";
import type { IncidentRecord } from "@/lib/api";

const STATUS_OPTIONS = ["open", "in_progress", "resolved"] as const;
type Row = Record<string, unknown>;

function titleCase(s: string) {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function statusTone(s: string) {
  return s === "resolved" ? ("green" as const) : s === "in_progress" ? ("amber" as const) : ("violet" as const);
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

export function IncidentDetail({ incident: initial }: { incident: IncidentRecord }) {
  const router = useRouter();
  const [incident, setIncident] = useState(initial);
  const [status, setStatus] = useState(initial.status);
  const [assignee, setAssignee] = useState(initial.assignee ?? "");
  const [busy, setBusy] = useState<"" | "status" | "assign" | "case">("");
  const [notice, setNotice] = useState("");

  const [evidence, setEvidence] = useState<Row[]>([]);
  const [evLoading, setEvLoading] = useState(true);
  const [evError, setEvError] = useState("");

  const mitre = (incident.tags ?? []).filter((t) => /^T1\d{3}/i.test(t));
  const entities = incident.entities ?? [];

  // Pull real evidence for the incident's entities straight from OpenSearch.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setEvLoading(true);
      setEvError("");
      if (entities.length === 0) { setEvLoading(false); return; }
      // Lucene query over OpenSearch: match the incident's entities against host / user /
      // IP fields (an entity may be a hostname, a username, or an IP).
      const esc = (e: string) => `"${e.replace(/"/g, "")}"`;
      const clauses = entities.flatMap((e) => [`host.name:${esc(e)}`, `user.name:${esc(e)}`, `source.ip:${esc(e)}`, `destination.ip:${esc(e)}`]);
      const query = clauses.join(" OR ");
      try {
        const data = (await backend("search", { method: "POST", body: JSON.stringify({ engine: "opensearch", query, size: 20 }) })) as { rows: Row[] };
        if (!cancelled) setEvidence(data.rows ?? []);
      } catch {
        if (!cancelled) setEvError("No live evidence — connect OpenSearch and ingest events.");
      } finally {
        if (!cancelled) setEvLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident.id]);

  async function patch(body: Record<string, unknown>, kind: "status" | "assign") {
    setBusy(kind);
    setNotice("");
    try {
      const updated = (await backend(`incidents/${incident.id}`, { method: "PATCH", body: JSON.stringify(body) })) as IncidentRecord;
      setIncident(updated);
      setStatus(updated.status);
      setNotice(kind === "status" ? `Status → ${titleCase(updated.status)}` : `Assigned to ${updated.assignee ?? "Unassigned"}`);
    } catch {
      setNotice("Update failed.");
    } finally {
      setBusy("");
    }
  }

  async function escalate() {
    setBusy("case");
    setNotice("");
    try {
      const c = (await backend("cases", {
        method: "POST",
        body: JSON.stringify({ title: incident.title, description: incident.description ?? "", incident_id: incident.id, tags: incident.tags ?? [] }),
      })) as { id: string };
      setNotice("Escalated to a case.");
      router.push(`/cases`);
      void c;
    } catch {
      setNotice("Escalation failed.");
      setBusy("");
    }
  }

  const evCols = evidence.length ? Object.keys(evidence[0]) : [];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-4 lg:px-5">
        <button type="button" aria-label="Back" onClick={() => router.push("/incidents")} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="size-5" /></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{incident.title}</h1>
            <SeverityBadge severity={incident.severity as Severity} />
            <StatusLabel tone={statusTone(status)}>{titleCase(status)}</StatusLabel>
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">Incident ID: {incident.id.slice(0, 8)}{incident.rule_title ? ` · Rule: ${incident.rule_title}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={escalate} disabled={busy !== ""}>{busy === "case" ? <Loader2 className="animate-spin" /> : <FileText />} Escalate to case</Button>
          <Button size="sm" variant="primary" onClick={() => router.push(`/assistant?context=${encodeURIComponent(incident.title)}`)}><Sparkles /> Investigate with Argus</Button>
        </div>
      </div>

      {notice ? <div className="mx-4 mt-4 rounded-control border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary lg:mx-5">{notice}</div> : null}

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] lg:p-5">
        <div className="space-y-4">
          <Panel title="Overview" eyebrow="Detection">
            <div className="space-y-4 p-4">
              <p className="text-sm leading-6 text-muted-foreground">{incident.description ?? "No description recorded."}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="soc-inset p-3"><p className="soc-label">Detected</p><p className="mt-1 flex items-center gap-2 text-sm"><Clock3 className="size-4 text-muted-foreground" /> {fmt(incident.detected_at ?? incident.created_at)}</p></div>
                <div className="soc-inset p-3"><p className="soc-label">Source</p><p className="mt-1 flex items-center gap-2 text-sm"><Plug className="size-4 text-muted-foreground" /> {incident.source ? <span className="font-mono uppercase text-primary">{incident.source}</span> : "—"}</p></div>
              </div>
              {entities.length ? (
                <div><p className="soc-label mb-1.5">Entities</p><div className="flex flex-wrap gap-1.5">{entities.map((e) => <span key={e} className="rounded-control border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{e}</span>)}</div></div>
              ) : null}
              {mitre.length ? (
                <div><p className="soc-label mb-1.5">MITRE ATT&CK</p><div className="flex flex-wrap gap-1.5">{mitre.map((m) => <span key={m} className="rounded-control border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">{m}</span>)}</div></div>
              ) : null}
              {(incident.tags ?? []).length ? (
                <div><p className="soc-label mb-1.5">Tags</p><div className="flex flex-wrap gap-1.5">{(incident.tags ?? []).filter((t) => !/^T1\d{3}/i.test(t)).map((t) => <span key={t} className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>)}</div></div>
              ) : null}
            </div>
          </Panel>

          <Panel title="Live evidence" eyebrow="Straight from OpenSearch" action={<StatusLabel tone={evidence.length ? "green" : "neutral"}>{evidence.length} events</StatusLabel>}>
            <div className="p-4">
              {evLoading ? (
                <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading events for {entities.join(", ") || "this incident"}…</p>
              ) : evError ? (
                <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Database className="size-4" /> {evError}</p>
              ) : evidence.length ? (
                <div className="soc-scrollbar max-h-80 overflow-auto rounded-control border border-border">
                  <table className="soc-table min-w-[640px]">
                    <thead><tr>{evCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>{evidence.map((row, i) => <tr key={i}>{evCols.map((c) => <td key={c} className="font-mono text-[11px] text-muted-foreground">{String(row[c] ?? "")}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No matching events in the datalake for this incident&apos;s entities.</p>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Triage" eyebrow="Update">
            <div className="space-y-4 p-4">
              <div className="space-y-1 text-sm">
                <span className="soc-label">Status</span>
                <div className="flex gap-2">
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 flex-1 rounded-control border border-border bg-surface px-3 capitalize outline-none focus:border-primary">
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                  </select>
                  <Button size="sm" variant="primary" onClick={() => patch({ status }, "status")} disabled={busy !== "" || status === incident.status}>
                    {busy === "status" ? <Loader2 className="animate-spin" /> : "Set"}
                  </Button>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <span className="soc-label">Assignee</span>
                <div className="flex gap-2">
                  <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="analyst@org" className="h-9 flex-1 rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" />
                  <Button size="sm" variant="secondary" onClick={() => patch({ assignee }, "assign")} disabled={busy !== ""}>
                    {busy === "assign" ? <Loader2 className="animate-spin" /> : <User />}
                  </Button>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Next steps" eyebrow="Recommended">
            <div className="space-y-2 p-4">
              <Button size="sm" variant="secondary" className="w-full justify-between" onClick={() => router.push(`/investigations?incident=${incident.id}`)}>Open investigation <ArrowRight /></Button>
              <Button size="sm" variant="secondary" className="w-full justify-between" onClick={escalate} disabled={busy !== ""}>Escalate to case <ArrowRight /></Button>
              <Button size="sm" variant="secondary" className="w-full justify-between" onClick={() => router.push(`/assistant?context=${encodeURIComponent(incident.title)}`)}>Ask Argus <ArrowRight /></Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
