"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, Fingerprint, Loader2, Plus, Search, Server, ShieldAlert, User, X, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricStrip, Panel, SeverityBadge, StatusLabel, WorkspaceTitle, type Severity } from "@/components/soc/flagship-ui";
import { cn } from "@/lib/utils";
import type { WorkspaceMetric } from "@/lib/workspace-data";

export interface AssetView {
  id: string;
  kind: string;
  name: string;
  criticality: string;
  risk: number;
  attributes: Record<string, unknown>;
  incidents: { id: string; title: string; severity: string }[];
  discovered?: boolean;
}

function formatAttrValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function formatAttrKey(k: string): string {
  return k.replace(/_/g, " ");
}

const KIND_ICON: Record<string, LucideIcon> = { host: Server, user: User, cloud: Cloud, identity: Fingerprint };
const KINDS = ["all", "host", "user", "cloud", "identity"] as const;

function critTone(c: string) {
  return c === "critical" || c === "high" ? ("red" as const) : c === "normal" ? ("violet" as const) : ("neutral" as const);
}
function riskColor(r: number) {
  return r >= 70 ? "bg-high" : r >= 40 ? "bg-medium" : "bg-low";
}
function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.status === 204 ? null : resp.json();
}

export function AssetsWorkspace({ assets: initial, metrics, discoveryAvailable, discoveryReason }: { assets: AssetView[]; metrics: WorkspaceMetric[]; discoveryAvailable?: boolean; discoveryReason?: string }) {
  const router = useRouter();
  const [assets, setAssets] = useState(initial);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? "");
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState({ name: "", kind: "host", criticality: "normal" });
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => (q ? a.name.toLowerCase().includes(q) : true) && (kind === "all" || a.kind === kind));
  }, [assets, query, kind]);
  const selected = assets.find((a) => a.id === selectedId) ?? filtered[0] ?? assets[0];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = (await backend("assets", { method: "POST", body: JSON.stringify({ ...draft, attributes: {} }) })) as { id: string; kind: string; name: string; criticality: string; risk_score: number; attributes: Record<string, unknown> };
      setAssets((a) => [{ ...created, risk: created.risk_score ?? 0, incidents: [] }, ...a]);
      setDrawer(false);
      setSelectedId(created.id);
      setDraft({ name: "", kind: "host", criticality: "normal" });
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle eyebrow="Inventory" title="Assets" description="Hosts and identities discovered from your OpenSearch logs — with live risk from correlated incidents." actions={<Button size="sm" variant="primary" onClick={() => setDrawer(true)}><Plus /> Add asset</Button>} />
      <MetricStrip metrics={metrics} />
      {discoveryAvailable === false ? (
        <div className="mx-4 mt-4 rounded-control border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400 lg:mx-5">
          Asset discovery is offline — {discoveryReason ?? "OpenSearch not connected"}. Connect a source under{" "}
          <button type="button" onClick={() => router.push("/integrations")} className="font-medium underline">Integrations</button> to populate device inventory from live logs.
        </div>
      ) : null}

      <div className="grid gap-4 p-4 lg:p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Inventory" eyebrow={`${filtered.length} assets`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search assets</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assets..." className="h-9 w-full rounded-control border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/50" />
            </label>
            {KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-control border px-2.5 py-1.5 text-xs capitalize", kind === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{k}</button>
            ))}
          </div>
          <div className="soc-scrollbar overflow-x-auto">
            <table className="soc-table min-w-[640px]">
              <thead><tr><th>Asset</th><th>Criticality</th><th>Risk</th><th>Incidents</th></tr></thead>
              <tbody>
                {filtered.map((a) => {
                  const Icon = KIND_ICON[a.kind] ?? Server;
                  return (
                    <tr key={a.id} className={cn("cursor-pointer", selected?.id === a.id ? "bg-primary/[0.045]" : "")} onClick={() => setSelectedId(a.id)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"><Icon className="size-4" /></span>
                          <div><p className="text-sm font-medium">{a.name}</p><p className="mt-0.5 text-[10px] uppercase text-muted-foreground">{a.kind}{a.discovered ? " · live" : ""}</p></div>
                        </div>
                      </td>
                      <td><StatusLabel tone={critTone(a.criticality)}>{titleCase(a.criticality)}</StatusLabel></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-surface"><div className={cn("h-full rounded-full", riskColor(a.risk))} style={{ width: `${Math.min(100, a.risk)}%` }} /></div>
                          <span className="font-mono text-xs">{a.risk}</span>
                        </div>
                      </td>
                      <td className="text-xs">{a.incidents.length ? <span className="inline-flex items-center gap-1 text-high"><ShieldAlert className="size-3.5" /> {a.incidents.length}</span> : <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? <tr><td colSpan={4} className="py-10 text-center text-sm text-muted-foreground">No assets match.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          {selected ? (
            <Panel title={selected.name} eyebrow={`${titleCase(selected.kind)} · ${titleCase(selected.criticality)}`} action={<StatusLabel tone={critTone(selected.criticality)}>Risk {selected.risk}</StatusLabel>}>
              <div className="space-y-4 p-4">
                <div>
                  <p className="soc-label mb-1.5">Risk</p>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface"><div className={cn("h-full rounded-full", riskColor(selected.risk))} style={{ width: `${Math.min(100, selected.risk)}%` }} /></div>
                </div>
                {Object.keys(selected.attributes ?? {}).length ? (
                  <div><p className="soc-label mb-1.5">{selected.discovered ? "Device information" : "Attributes"}</p><div className="space-y-1">{Object.entries(selected.attributes).map(([k, v]) => <div key={k} className="flex justify-between gap-2 text-xs"><span className="capitalize text-muted-foreground">{formatAttrKey(k)}</span><span className="truncate text-right font-mono">{formatAttrValue(v)}</span></div>)}</div></div>
                ) : null}
                <div>
                  <p className="soc-label mb-1.5">Related incidents</p>
                  {selected.incidents.length ? (
                    <div className="space-y-1.5">
                      {selected.incidents.map((i) => (
                        <button key={i.id} type="button" onClick={() => router.push(`/incidents/${i.id}`)} className="flex w-full items-center justify-between gap-2 rounded-control border border-border bg-surface px-3 py-2 text-left text-xs hover:border-primary/40">
                          <span className="truncate">{i.title}</span>
                          <SeverityBadge severity={i.severity as Severity} />
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">No incidents reference this asset.</p>}
                </div>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="ml-auto flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="text-base font-semibold">Add asset</h2><Button size="icon" variant="ghost" aria-label="Close" onClick={() => setDrawer(false)}><X /></Button></div>
            <form onSubmit={submit} className="flex flex-1 flex-col gap-4 p-4">
              <label className="space-y-1 text-sm"><span className="soc-label">Name</span><input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" /></label>
              <label className="space-y-1 text-sm"><span className="soc-label">Kind</span><select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 capitalize outline-none focus:border-primary">{["host", "user", "cloud", "identity"].map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span className="soc-label">Criticality</span><select value={draft.criticality} onChange={(e) => setDraft((d) => ({ ...d, criticality: e.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 capitalize outline-none focus:border-primary">{["low", "normal", "high", "critical"].map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
              <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-4"><Button size="sm" variant="secondary" onClick={() => setDrawer(false)}>Cancel</Button><Button size="sm" variant="primary" type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus />} Add</Button></div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
