"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plug, Plus, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricStrip, SeverityBadge, StatusLabel, WorkspaceTitle, type Severity } from "@/components/soc/flagship-ui";
import { RULE_TYPES, ruleTypeName, type RuleType } from "@/lib/rule-types";
import type { RuleRecord } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.status === 204 ? null : resp.json();
}

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function RulesWorkspace({ rules: initial, metrics }: { rules: RuleRecord[]; metrics: WorkspaceMetric[] }) {
  const router = useRouter();
  const [rules, setRules] = useState(initial);
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState(false);
  const [creating, setCreating] = useState<RuleType | "">("");
  const [deleting, setDeleting] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((r) =>
      [r.title, r.type, r.author ?? "", ...(r.tags ?? [])].some((v) => v.toLowerCase().includes(q)),
    );
  }, [query, rules]);

  async function removeRule(rule: RuleRecord) {
    if (!window.confirm(`Delete rule "${rule.title}"?${rule.monitor_id ? " Its OpenSearch monitor is removed too." : ""}`)) return;
    setDeleting(rule.id);
    try {
      if (rule.monitor_id) await backend(`rules/monitors/${rule.monitor_id}`, { method: "DELETE" }).catch(() => {});
      await backend(`rules/${rule.id}`, { method: "DELETE" });
      setRules((rs) => rs.filter((r) => r.id !== rule.id));
    } catch {
      /* leave row */
    } finally {
      setDeleting("");
    }
  }

  async function createRule(spec: (typeof RULE_TYPES)[number]) {
    setCreating(spec.type);
    try {
      const title = `New ${spec.name}`;
      const created = (await backend("rules", {
        method: "POST",
        body: JSON.stringify({ title, type: spec.type, severity: "medium", yaml: spec.template(title), tags: [] }),
      })) as RuleRecord;
      router.push(`/rules/${created.id}`);
    } catch {
      setCreating("");
      setPicker(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle
        eyebrow="Detection-as-code"
        title="Rules"
        description="Manage detections, generate them with the Detection-Engineering agent, and deploy to your integrations."
        actions={
          <Button size="sm" variant="primary" onClick={() => setPicker(true)}>
            <Plus /> Rule
          </Button>
        }
      />
      <MetricStrip metrics={metrics} />

      <div className="p-4 lg:p-5">
        <div className="soc-panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-surface-subtle/35 p-3">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search rules</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search rules by title, type, tag, author..."
                className="h-9 w-full rounded-control border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/50"
              />
            </label>
            <span className="text-xs text-muted-foreground">{filtered.length} rules</span>
          </div>

          <div className="soc-scrollbar overflow-x-auto">
            <table className="soc-table min-w-[820px]">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Author</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rule) => (
                  <tr key={rule.id} className="cursor-pointer" onClick={() => router.push(`/rules/${rule.id}`)}>
                    <td>
                      <p className="text-sm font-medium">{rule.title}</p>
                      <p className="mt-0.5 flex flex-wrap gap-1">
                        {(rule.tags ?? []).slice(0, 3).map((t) => (
                          <span key={t} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{t}</span>
                        ))}
                      </p>
                    </td>
                    <td className="text-xs text-muted-foreground">{ruleTypeName(rule.type)}</td>
                    <td><SeverityBadge severity={rule.severity as Severity} /></td>
                    <td className="text-xs">
                      {rule.integration ? (
                        <span className="inline-flex items-center gap-1 font-mono uppercase text-primary"><Plug className="size-3" /> {rule.integration}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td><StatusLabel tone={rule.enabled ? "green" : "neutral"}>{rule.enabled ? "Enabled" : "Disabled"}</StatusLabel></td>
                    <td className="text-xs text-muted-foreground">{rule.author ?? "—"}</td>
                    <td className="font-mono text-xs text-muted-foreground">{timeAgo(rule.updated_at ?? rule.created_at)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <Button size="icon" variant="ghost" aria-label={`Delete ${rule.title}`} onClick={() => removeRule(rule)} disabled={deleting === rule.id}>
                          {deleting === rule.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No rules match your search.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {picker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-card border border-border bg-popover p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Search className="size-5 text-primary" /> Select Rule Type</h2>
              <button type="button" aria-label="Close" onClick={() => setPicker(false)}><X className="size-5 text-muted-foreground" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {RULE_TYPES.map((spec) => {
                const Icon = spec.icon;
                return (
                  <button
                    key={spec.type}
                    type="button"
                    disabled={creating !== ""}
                    onClick={() => createRule(spec)}
                    className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 text-left transition hover:border-primary/50 hover:bg-primary/[0.04] disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <span className="flex size-8 items-center justify-center rounded-control bg-primary/10 text-primary">
                        {creating === spec.type ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                      </span>
                      {spec.name}
                    </span>
                    <span className="text-xs leading-5 text-muted-foreground">{spec.blurb}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
