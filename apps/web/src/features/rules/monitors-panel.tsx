"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Power, Radio, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, StatusLabel } from "@/components/soc/flagship-ui";
import type { MonitorRecord } from "@/lib/api";

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.status === 204 ? null : resp.json();
}

export function MonitorsPanel() {
  const router = useRouter();
  const [monitors, setMonitors] = useState<MonitorRecord[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = (await backend("rules/monitors")) as { available: boolean; monitors: MonitorRecord[] };
      setMonitors(d.monitors ?? []);
      setAvailable(d.available);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggle(id: string) {
    setBusy(id);
    try {
      const r = (await backend(`rules/monitors/${id}/toggle`, { method: "POST" })) as { enabled: boolean };
      setMonitors((m) => m.map((x) => (x.id === id ? { ...x, enabled: r.enabled } : x)));
    } finally { setBusy(""); }
  }
  async function remove(id: string) {
    setBusy(id);
    try { await backend(`rules/monitors/${id}`, { method: "DELETE" }); setMonitors((m) => m.filter((x) => x.id !== id)); }
    finally { setBusy(""); }
  }
  async function importAsRule(id: string) {
    setBusy(id);
    try { const r = (await backend(`rules/monitors/${id}/import`, { method: "POST" })) as { id: string }; router.push(`/rules/${r.id}`); }
    catch { setBusy(""); }
  }

  if (!available && monitors.length === 0 && !loading) return null;

  return (
    <div className="px-4 lg:px-5">
      <Panel
        title="Deployed monitors"
        eyebrow="OpenSearch Alerting"
        action={
          <div className="flex items-center gap-2">
            <StatusLabel tone={monitors.length ? "green" : "neutral"}>{monitors.length} live</StatusLabel>
            <Button size="icon" variant="ghost" aria-label="Refresh" onClick={load} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}</Button>
          </div>
        }
      >
        <div className="soc-scrollbar overflow-x-auto">
          <table className="soc-table min-w-[680px]">
            <thead>
              <tr><th>Monitor</th><th>Type</th><th>Schedule</th><th>State</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {monitors.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-control bg-primary/10 text-primary"><Radio className="size-3.5" /></span>
                      <span className="text-sm font-medium">{m.name}</span>
                    </div>
                  </td>
                  <td className="text-xs text-muted-foreground">{m.monitor_type?.replace(/_/g, " ") ?? "—"}</td>
                  <td className="text-xs text-muted-foreground">{m.schedule?.period ? `every ${m.schedule.period.interval} ${m.schedule.period.unit.toLowerCase()}` : "—"}</td>
                  <td><StatusLabel tone={m.enabled ? "green" : "neutral"}>{m.enabled ? "Enabled" : "Disabled"}</StatusLabel></td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => toggle(m.id)} disabled={busy === m.id}>{busy === m.id ? <Loader2 className="animate-spin" /> : <Power />} {m.enabled ? "Disable" : "Enable"}</Button>
                      <Button size="sm" variant="secondary" onClick={() => importAsRule(m.id)} disabled={busy === m.id} title="Import as Aegis rule"><Download /></Button>
                      <Button size="icon" variant="ghost" aria-label="Delete monitor" onClick={() => remove(m.id)} disabled={busy === m.id}><Trash2 /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {monitors.length === 0 && !loading ? <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No monitors deployed yet — apply a rule to OpenSearch.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
