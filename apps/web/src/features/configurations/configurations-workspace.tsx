"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, FileCode2, Layers, Loader2, Radio, Save, Search, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricStrip, Panel, StatusLabel, WorkspaceTitle } from "@/components/soc/flagship-ui";
import type { AutonomyPolicy, IntegrationRecord, Metrics, TenantSettings } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

type Health = { detail?: string; latency_ms?: number; error?: string };
const SEVERITIES = ["low", "medium", "high", "critical"];
const FREQUENCIES = ["5m", "15m", "30m", "1h", "6h", "24h"];
const RETENTIONS = [7, 30, 90, 180, 365];

function tone(status?: string) {
  return status === "connected" ? ("green" as const) : status === "error" ? ("red" as const) : ("neutral" as const);
}
function titleCase(s: string) {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.status === 204 ? null : resp.json();
}

export function ConfigurationsWorkspace({
  metrics,
  integrations,
  policies,
  tenantId,
  strip,
  settings,
}: {
  metrics: Metrics;
  integrations: IntegrationRecord[];
  policies: AutonomyPolicy[];
  tenantId: string;
  strip: WorkspaceMetric[];
  settings: TenantSettings;
}) {
  const router = useRouter();
  const [det, setDet] = useState(settings.detection);
  const [savedDet, setSavedDet] = useState(settings.detection);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const detDirty = JSON.stringify(det) !== JSON.stringify(savedDet);

  async function saveDetection() {
    setBusy(true);
    setNotice("");
    try {
      const updated = (await backend("settings", { method: "PUT", body: JSON.stringify({ detection: det }) })) as TenantSettings;
      setDet(updated.detection);
      setSavedDet(updated.detection);
      setNotice("Detection config saved.");
    } catch {
      setNotice("Save failed — needs admin (autonomy:write).");
    } finally {
      setBusy(false);
    }
  }
  const clickhouse = integrations.find((i) => i.provider === "clickhouse");
  const opensearch = integrations.find((i) => i.provider === "opensearch");
  const stores = [
    { name: "ClickHouse", icon: Database, blurb: "Analytics datalake", rec: clickhouse },
    { name: "OpenSearch", icon: Search, blurb: "Search & correlation", rec: opensearch },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle eyebrow="Platform" title="Configurations" description="Data plane, detection engine, and tenancy settings for this workspace." />
      <MetricStrip metrics={strip} />
      {notice ? <div className="mx-4 mt-4 rounded-control border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary lg:mx-5">{notice}</div> : null}

      <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-5">
        <Panel title="Data plane" eyebrow="Stores">
          <div className="divide-y divide-border">
            {stores.map((s) => {
              const Icon = s.icon;
              const health = ((s.rec as unknown as { health?: Health })?.health) ?? {};
              return (
                <div key={s.name} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 items-center justify-center rounded-control bg-primary/10 text-primary"><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{s.name}</p><p className="truncate text-xs text-muted-foreground">{health.detail ?? s.blurb}</p></div>
                  <StatusLabel tone={tone(s.rec?.status)}>{s.rec?.status ? titleCase(s.rec.status) : "Not set"}</StatusLabel>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
              <span>Configure connectors on the Integrations page.</span>
              <button type="button" onClick={() => router.push("/integrations")} className="text-primary hover:underline">Open →</button>
            </div>
          </div>
        </Panel>

        <Panel title="Detection engine" eyebrow="Editable" action={<Button size="sm" variant="primary" onClick={saveDetection} disabled={busy || !detDirty}>{busy ? <Loader2 className="animate-spin" /> : <Save />} Save</Button>}>
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="soc-inset p-3"><p className="soc-label flex items-center gap-1"><FileCode2 className="size-3" /> Enabled rules</p><p className="mt-1 text-xl font-semibold">{metrics.rules.enabled}<span className="text-sm text-muted-foreground">/{metrics.rules.total}</span></p></div>
              <div className="soc-inset p-3"><p className="soc-label flex items-center gap-1"><ShieldCheck className="size-3" /> MITRE techniques</p><p className="mt-1 text-xl font-semibold">{metrics.rules.mitre_techniques.length}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm"><span className="soc-label">Default severity</span>
                <select value={det.default_severity} onChange={(e) => setDet((d) => ({ ...d, default_severity: e.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 capitalize outline-none focus:border-primary">{SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span className="soc-label">Schedule frequency</span>
                <select value={det.schedule_frequency} onChange={(e) => setDet((d) => ({ ...d, schedule_frequency: e.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary">{FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span className="soc-label">Retention (days)</span>
                <select value={det.retention_days} onChange={(e) => setDet((d) => ({ ...d, retention_days: Number(e.target.value) }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary">{RETENTIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
              <label className="flex items-center justify-between gap-2 text-sm"><span className="soc-label">Auto-close FPs</span>
                <button type="button" onClick={() => setDet((d) => ({ ...d, auto_close_fp: !d.auto_close_fp }))} className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${det.auto_close_fp ? "bg-primary" : "bg-surface"}`}><span className={`block size-5 rounded-full bg-white transition ${det.auto_close_fp ? "translate-x-5" : ""}`} /></button></label>
            </div>
            <div><p className="soc-label mb-1.5 flex items-center gap-1"><Radio className="size-3" /> Coverage</p><div className="flex flex-wrap gap-1">{metrics.rules.mitre_techniques.slice(0, 12).map((t) => <span key={t} className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">{t}</span>)}</div></div>
          </div>
        </Panel>

        <Panel title="Autonomy defaults" eyebrow="Response policy">
          <div className="divide-y divide-border">
            {policies.length ? policies.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm"><span>{titleCase(p.action_class)}</span><StatusLabel tone={p.mode === "auto" ? "green" : p.mode === "approve" ? "amber" : "red"}>{titleCase(p.mode)}</StatusLabel></div>
            )) : <p className="px-4 py-6 text-center text-sm text-muted-foreground">No policies set — defaults apply.</p>}
            <div className="px-4 py-3 text-right"><button type="button" onClick={() => router.push("/automation")} className="text-xs text-primary hover:underline">Manage in Automation →</button></div>
          </div>
        </Panel>

        <Panel title="Tenancy" eyebrow="Isolation">
          <div className="space-y-3 p-4 text-sm">
            <div className="soc-inset p-3"><p className="soc-label">Tenant ID</p><p className="mt-1 break-all font-mono text-xs">{tenantId}</p></div>
            <div className="soc-inset p-3"><p className="soc-label flex items-center gap-1"><Layers className="size-3" /> OpenSearch index prefix</p><p className="mt-1 font-mono text-xs">t-{tenantId}-*</p></div>
            <p className="text-xs text-muted-foreground">Every query is scoped to this tenant via row-level security and the per-tenant index prefix.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
