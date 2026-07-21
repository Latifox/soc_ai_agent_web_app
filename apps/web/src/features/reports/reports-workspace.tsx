"use client";

import { useState } from "react";
import { Download, FileBarChart, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricStrip, Panel, StatusLabel, WorkspaceTitle } from "@/components/soc/flagship-ui";
import { cn } from "@/lib/utils";
import type { ReportRecord } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

const KINDS = [
  { key: "executive", label: "Executive summary" },
  { key: "incident", label: "Incident report" },
  { key: "detection", label: "Detection coverage" },
];

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

function downloadReport(r: ReportRecord) {
  const lines = [`# ${r.title}`, `Generated: ${fmt(r.generated_at)}`, ""];
  for (const s of r.sections) {
    lines.push(`## ${s.heading}`);
    if (s.body) lines.push(s.body);
    for (const it of s.items ?? []) lines.push(`- ${it}`);
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${r.title.replace(/\s+/g, "-").toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsWorkspace({ reports: initial, metrics }: { reports: ReportRecord[]; metrics: WorkspaceMetric[] }) {
  const [reports, setReports] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? "");
  const [kind, setKind] = useState("executive");
  const [busy, setBusy] = useState(false);
  const selected = reports.find((r) => r.id === selectedId) ?? reports[0];

  async function generate() {
    setBusy(true);
    try {
      const r = (await backend("reports/generate", { method: "POST", body: JSON.stringify({ kind, window_days: 30 }) })) as ReportRecord;
      setReports((c) => [r, ...c]);
      setSelectedId(r.id);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle
        eyebrow="Reporting"
        title="Reports"
        description="Point-in-time executive and operational summaries composed from your live SOC data."
        actions={
          <div className="flex items-center gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 rounded-control border border-border bg-surface px-2 text-sm outline-none focus:border-primary">
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
            <Button size="sm" variant="primary" onClick={generate} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus />} Generate</Button>
          </div>
        }
      />
      <MetricStrip metrics={metrics} />

      <div className="grid gap-4 p-4 lg:p-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title="Generated reports" eyebrow={`${reports.length} total`}>
          <div className="divide-y divide-border">
            {reports.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground"><FileBarChart className="mx-auto mb-1 size-5" /> No reports yet — generate one.</p> : null}
            {reports.map((r) => (
              <button key={r.id} type="button" onClick={() => setSelectedId(r.id)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-primary/[0.035]", selected?.id === r.id ? "bg-primary/[0.05]" : "")}>
                <span className="flex size-8 items-center justify-center rounded-control bg-primary/10 text-primary"><FileBarChart className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.title}</p><p className="text-[11px] text-muted-foreground">{fmt(r.generated_at)}</p></div>
                <StatusLabel tone="violet">{r.kind}</StatusLabel>
              </button>
            ))}
          </div>
        </Panel>

        {selected ? (
          <Panel title={selected.title} eyebrow={`${selected.window_days}-day window`} action={<Button size="sm" variant="secondary" onClick={() => downloadReport(selected)}><Download /> Export</Button>}>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(selected.metrics).map(([k, v]) => (
                  <div key={k} className="soc-inset p-3"><p className="soc-label capitalize">{k.replace(/_/g, " ")}</p><p className="mt-1 text-xl font-semibold tabular-nums">{v}</p></div>
                ))}
              </div>
              {selected.sections.map((s) => (
                <div key={s.heading}>
                  <h3 className="mb-2 text-sm font-semibold text-primary">{s.heading}</h3>
                  {s.body ? <p className="text-sm leading-6 text-muted-foreground">{s.body}</p> : null}
                  {s.items ? <ul className="space-y-1">{s.items.map((it, i) => <li key={i} className="flex gap-2 text-sm text-muted-foreground"><span className="text-primary">·</span> {it}</li>)}</ul> : null}
                </div>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="No report selected" eyebrow="Reporting"><p className="p-8 text-center text-sm text-muted-foreground">Generate a report to see it here.</p></Panel>
        )}
      </div>
    </div>
  );
}
