"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Filter, Plug, Search, ShieldAlert, User } from "lucide-react";

import { MetricStrip, SeverityBadge, StatusLabel, WorkspaceTitle, type Severity } from "@/components/soc/flagship-ui";
import { cn } from "@/lib/utils";
import type { IncidentRecord } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

const STATUSES = ["all", "open", "in_progress", "resolved"] as const;

function statusTone(status: string) {
  if (status === "resolved") return "green" as const;
  if (status === "in_progress") return "amber" as const;
  return "violet" as const;
}

function borderForSeverity(sev: string) {
  return sev === "critical" || sev === "high" ? "border-l-high" : sev === "medium" ? "border-l-medium" : "border-l-low";
}

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function titleCase(s: string) {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function IncidentsList({ incidents, metrics }: { incidents: IncidentRecord[]; metrics: WorkspaceMetric[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [showFilter, setShowFilter] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return incidents.filter((i) => {
      const matchesQ = q ? [i.title, i.description ?? "", ...(i.tags ?? []), ...(i.entities ?? [])].some((v) => v.toLowerCase().includes(q)) : true;
      return matchesQ && (status === "all" || i.status === status);
    });
  }, [incidents, query, status]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle eyebrow="Detections" title="Incidents" description="Monitor and manage security incidents raised by your detections and integrations." />
      <MetricStrip metrics={metrics} />

      <div className="space-y-4 p-4 lg:p-5">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search incidents</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search incidents..."
              className="h-10 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary/50"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowFilter((v) => !v)}
            className={cn("flex h-10 items-center gap-2 rounded-control border px-3 text-sm", showFilter ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
          >
            <Filter className="size-4" /> Filter
          </button>
        </div>

        {showFilter ? (
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn("rounded-control border px-3 py-1.5 text-xs capitalize", status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
              >
                {s === "all" ? "All" : titleCase(s)}
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-3">
          {filtered.map((inc) => (
            <button
              key={inc.id}
              type="button"
              onClick={() => router.push(`/incidents/${inc.id}`)}
              className={cn("soc-panel block w-full border-l-4 p-0 text-left transition hover:border-primary/40", borderForSeverity(inc.severity))}
            >
              <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold">{inc.title}</h3>
                    <StatusLabel tone={statusTone(inc.status)}>{titleCase(inc.status)}</StatusLabel>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    Incident ID: {inc.id.slice(0, 8)}{inc.rule_title ? ` · Rule: ${inc.rule_title}` : ""}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{inc.description ?? "No description."}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(inc.tags ?? []).slice(0, 4).map((t) => (
                      <span key={t} className="rounded-control bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="border-l border-border pl-4 text-sm lg:pl-5">
                  <p className="soc-label mb-2">Detection details</p>
                  <p className="flex items-center gap-2 text-muted-foreground"><Clock3 className="size-4" /> {fmt(inc.detected_at ?? inc.created_at)}</p>
                  <p className="mt-2 flex items-center gap-2"><ShieldAlert className="size-4 text-muted-foreground" /> Severity: <SeverityBadge severity={inc.severity as Severity} /></p>
                  {inc.source ? (
                    <p className="mt-2 flex items-center gap-2 text-muted-foreground"><Plug className="size-4" /> Source: <span className="font-mono uppercase text-primary">{inc.source}</span></p>
                  ) : null}
                </div>

                <div className="border-l border-border pl-4 text-sm lg:pl-5">
                  <p className="soc-label mb-2">Assigned to</p>
                  <p className="flex items-center gap-2"><User className="size-4 text-muted-foreground" /> {inc.assignee ?? "Unassigned"}</p>
                  <p className="soc-label mb-1 mt-3">Status</p>
                  <StatusLabel tone={statusTone(inc.status)}>{titleCase(inc.status)}</StatusLabel>
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 ? (
            <div className="soc-panel py-12 text-center text-sm text-muted-foreground">No incidents match your filters.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
