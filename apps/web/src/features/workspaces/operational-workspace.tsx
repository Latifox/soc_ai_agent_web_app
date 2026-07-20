"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Cloud,
  FileCode2,
  Filter,
  KeyRound,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DetailLink,
  MetricStrip,
  Panel,
  SeverityBadge,
  StatusLabel,
  WorkspaceTitle,
  type Severity,
} from "@/components/soc/flagship-ui";
import { allNavItems } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { WorkspaceConfig, WorkspaceRecord } from "@/lib/workspace-data";

const pageSize = 4;
const severities: Array<Severity | "all"> = ["all", "critical", "high", "medium", "low", "info"];
const columnIds = ["primary", "severity", "source", "updated", "status"] as const;
type ColumnId = (typeof columnIds)[number];

const iconFallbacks: Record<string, LucideIcon> = {
  "/rules": FileCode2,
  "/integrations": Cloud,
};

function toneForStatus(status: string) {
  if (["Enabled", "Connected", "Active", "Ready", "Managed", "Closed"].includes(status)) return "green" as const;
  if (["Issue", "Paused", "Review", "Near SLA", "Exposed", "Elevated"].includes(status)) return "red" as const;
  if (["Triage", "Monitoring", "Scheduled", "In progress", "Open"].includes(status)) return "amber" as const;
  return "violet" as const;
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function exportRows(config: WorkspaceConfig, rows: WorkspaceRecord[]) {
  const header = ["id", "name", "detail", "severity", "source", "updated", "status", "owner"];
  const body = rows.map((row) =>
    [row.id, row.primary, row.secondary, row.severity, row.source, row.updated, row.status, row.owner].map(csvEscape).join(","),
  );
  const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `aegis-${config.key}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function OperationalWorkspace({ config }: { config: WorkspaceConfig }) {
  const router = useRouter();
  const navItem = allNavItems.find((item) => item.href === config.href);
  const Icon = navItem?.icon ?? iconFallbacks[config.href] ?? SlidersHorizontal;

  const [records, setRecords] = useState(config.records);
  const [selectedId, setSelectedId] = useState(config.records[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [showColumns, setShowColumns] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(new Set(columnIds));
  const [draft, setDraft] = useState({
    primary: "",
    secondary: "",
    source: "",
    owner: "Unassigned",
    severity: "medium" as Severity,
    status: "Open",
  });

  const statusOptions = useMemo(() => ["all", ...Array.from(new Set(records.map((row) => row.status)))], [records]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((row) => {
      const matchesQuery = normalizedQuery
        ? [row.id, row.primary, row.secondary, row.source, row.status, row.owner].some((value) => value.toLowerCase().includes(normalizedQuery))
        : true;
      return matchesQuery && (severity === "all" || row.severity === severity) && (status === "all" || row.status === status);
    });
  }, [query, records, severity, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visibleRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const selected = records.find((row) => row.id === selectedId) ?? visibleRows[0] ?? records[0];

  function toggleColumn(column: ColumnId) {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(column) && next.size > 1) next.delete(column);
      else next.add(column);
      return next;
    });
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const now = new Date();
    const newRecord: WorkspaceRecord = {
      id: `${config.idPrefix}-${now.getHours()}${now.getMinutes()}${now.getSeconds()}`,
      primary: draft.primary.trim() || `New ${config.title.toLowerCase()} item`,
      secondary: draft.secondary.trim() || "Created from command center",
      source: draft.source.trim() || "Manual",
      owner: draft.owner.trim() || "Unassigned",
      severity: draft.severity,
      status: draft.status.trim() || "Open",
      updated: "just now",
      description: `${config.action} submitted from the ${config.title} workspace.`,
    };
    setRecords((current) => [newRecord, ...current]);
    setSelectedId(newRecord.id);
    setDrawerOpen(false);
    setNotice(`${newRecord.id} created and selected.`);
    setDraft({ primary: "", secondary: "", source: "", owner: "Unassigned", severity: "medium", status: "Open" });
  }

  function updateSelectedStatus(nextStatus: string) {
    if (!selected) return;
    setRecords((current) => current.map((row) => (row.id === selected.id ? { ...row, status: nextStatus, updated: "just now" } : row)));
    setNotice(`${selected.id} moved to ${nextStatus}.`);
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => exportRows(config, filtered)}>
              <ArrowDownToLine /> Export
            </Button>
            <Button size="sm" variant="primary" onClick={() => setDrawerOpen(true)}>
              <Plus /> {config.action}
            </Button>
          </>
        }
      />
      <MetricStrip metrics={config.metrics} />

      {notice ? (
        <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-control border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary lg:mx-5">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 p-4 lg:p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title={`${config.title} workspace`} eyebrow="Local interactive state" action={<StatusLabel tone="green">Live UI</StatusLabel>}>
          <div className="flex flex-col gap-2 border-b border-border bg-surface-subtle/35 p-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search {config.title}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder={`Search ${config.title.toLowerCase()}...`}
                className="h-9 w-full rounded-control border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <div className="relative flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowColumns((value) => !value)}>
                <SlidersHorizontal /> Columns
              </Button>
              <Button size="sm" variant={showFilters ? "primary" : "secondary"} onClick={() => setShowFilters((value) => !value)}>
                <Filter /> Filter
              </Button>
              <Button size="icon" variant="secondary" aria-label="Clear filters" onClick={() => { setQuery(""); setSeverity("all"); setStatus("all"); setPage(0); }}>
                <MoreHorizontal />
              </Button>
              {showColumns ? (
                <div className="absolute right-0 top-10 z-10 w-52 rounded-card border border-border bg-popover p-2 shadow-lg">
                  {columnIds.map((column, index) => (
                    <label key={column} className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-xs hover:bg-muted">
                      <input type="checkbox" checked={visibleColumns.has(column)} onChange={() => toggleColumn(column)} className="accent-primary" />
                      {config.columns[index]}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {showFilters ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              {severities.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setSeverity(item); setPage(0); }}
                  className={cn("rounded-control border px-2.5 py-1.5 text-xs capitalize transition", severity === item ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  {item}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                Status
                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className="h-8 rounded-control border border-border bg-background px-2 text-foreground">
                  {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
          ) : null}

          <div className="soc-scrollbar overflow-x-auto">
            <table className="soc-table min-w-[760px]">
              <thead>
                <tr>
                  {visibleColumns.has("primary") ? <th>{config.columns[0]}</th> : null}
                  {visibleColumns.has("severity") ? <th>{config.columns[1]}</th> : null}
                  {visibleColumns.has("source") ? <th>{config.columns[2]}</th> : null}
                  {visibleColumns.has("updated") ? <th>{config.columns[3]}</th> : null}
                  {visibleColumns.has("status") ? <th>{config.columns[4]}</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className={cn("cursor-pointer", selected?.id === row.id ? "bg-primary/[0.045]" : "")} onClick={() => setSelectedId(row.id)}>
                    {visibleColumns.has("primary") ? (
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"><Icon className="size-4" /></span>
                          <div>
                            <p className="text-sm font-medium">{row.primary}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.secondary}</p>
                          </div>
                        </div>
                      </td>
                    ) : null}
                    {visibleColumns.has("severity") ? <td><SeverityBadge severity={row.severity} /></td> : null}
                    {visibleColumns.has("source") ? <td className="text-xs text-muted-foreground">{row.source}</td> : null}
                    {visibleColumns.has("updated") ? <td className="font-mono text-xs text-muted-foreground">{row.updated}</td> : null}
                    {visibleColumns.has("status") ? <td><StatusLabel tone={toneForStatus(row.status)}>{row.status}</StatusLabel></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Showing {visibleRows.length ? safePage * pageSize + 1 : 0}-{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}</p>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={safePage >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>Next</Button>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title={selected?.primary ?? "No selection"} eyebrow="Selected record" action={selected ? <SeverityBadge severity={selected.severity} /> : null}>
            {selected ? (
              <div className="space-y-4 p-4">
                <p className="text-xs leading-5 text-muted-foreground">{selected.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="soc-inset p-3"><p className="soc-label">Owner</p><p className="mt-1 font-medium">{selected.owner}</p></div>
                  <div className="soc-inset p-3"><p className="soc-label">Source</p><p className="mt-1 font-medium">{selected.source}</p></div>
                  <div className="soc-inset p-3"><p className="soc-label">Status</p><p className="mt-1"><StatusLabel tone={toneForStatus(selected.status)}>{selected.status}</StatusLabel></p></div>
                  <div className="soc-inset p-3"><p className="soc-label">Updated</p><p className="mt-1 font-mono">{selected.updated}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => updateSelectedStatus("Review")}>Mark review</Button>
                  <Button size="sm" variant="primary" onClick={() => router.push(config.key === "cases" ? "/investigations" : "/assistant")}>
                    Open <ArrowRight />
                  </Button>
                </div>
              </div>
            ) : <p className="p-4 text-sm text-muted-foreground">No rows match the active filters.</p>}
          </Panel>

          <Panel title={config.contextTitle} eyebrow="Current posture">
            <div className="divide-y divide-border">
              {config.context.map((entry) => (
                <div key={entry.label} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-xs text-muted-foreground">{entry.label}</span>
                  <StatusLabel tone={entry.tone ?? "neutral"}>{entry.value}</StatusLabel>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Argus insight" eyebrow="Autonomous analysis">
            <div className="p-4">
              <div className="flex items-center gap-2 text-primary">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10"><Bot className="size-4" /></span>
                <span className="text-sm font-semibold">Recommended next action</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{config.insight}</p>
              <div className="mt-4 space-y-2 text-xs">
                <p className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-low" /> Tenant boundaries enforced</p>
                <p className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-low" /> Actions fully audited</p>
                <p className="flex items-center gap-2"><KeyRound className="size-3.5 text-low" /> Least-privilege access</p>
              </div>
              <div className="mt-4">
                <DetailLink onClick={() => router.push(`/assistant?context=${encodeURIComponent(config.title)}`)}>Ask Argus about this view</DetailLink>
              </div>
            </div>
          </Panel>

          <div className="soc-panel flex items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-control bg-primary/10 text-primary"><Activity className="size-4" /></span>
            <div><p className="text-xs font-semibold">Aegis control plane</p><p className="text-[10px] text-muted-foreground">{filtered.length} visible records synced locally</p></div>
            <ChevronDown className="ml-auto size-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="ml-auto flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="soc-eyebrow">{config.eyebrow}</p>
                <h2 className="text-base font-semibold">{config.action}</h2>
              </div>
              <Button size="icon" variant="ghost" aria-label="Close drawer" onClick={() => setDrawerOpen(false)}><X /></Button>
            </div>
            <form onSubmit={submitDraft} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              <label className="space-y-1 text-sm">
                <span className="soc-label">Name</span>
                <input value={draft.primary} onChange={(event) => setDraft((current) => ({ ...current, primary: event.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="soc-label">Detail</span>
                <input value={draft.secondary} onChange={(event) => setDraft((current) => ({ ...current, secondary: event.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm">
                  <span className="soc-label">Severity</span>
                  <select value={draft.severity} onChange={(event) => setDraft((current) => ({ ...current, severity: event.target.value as Severity }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary">
                    {severities.filter((item) => item !== "all").map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="soc-label">Status</span>
                  <input value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm">
                  <span className="soc-label">Source</span>
                  <input value={draft.source} onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="soc-label">Owner</span>
                  <input value={draft.owner} onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" />
                </label>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-4">
                <Button size="sm" variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
                <Button size="sm" variant="primary" type="submit">{config.action}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
