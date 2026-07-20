"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Bot,
  ExternalLink,
  Laptop,
  Network,
  RefreshCw,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ApprovalCard,
  ConfidenceMeter,
  DetailLink,
  EventTimeline,
  Panel,
  PriorityQueue,
  SeverityBadge,
  StatusLabel,
} from "@/components/soc/flagship-ui";
import { incidentQueue, investigationEvents, mitreMappings } from "@/lib/demo-soc-data";
import { cn } from "@/lib/utils";

const tabs = ["Attack story", "Timeline", "Graph", "Evidence (24)", "Correlations (7)", "Notes (0)"];
const filters = ["All", "Identity", "Endpoint", "Network", "Process"];

export function InvestigationWorkspace() {
  const [selectedId, setSelectedId] = useState(incidentQueue[0].id);
  const [activeTab, setActiveTab] = useState("Attack story");
  const [activeFilter, setActiveFilter] = useState("All");
  const selected = incidentQueue.find((incident) => incident.id === selectedId) ?? incidentQueue[0];
  const events = useMemo(
    () => activeFilter === "All" ? investigationEvents : investigationEvents.filter((event) => event.category === activeFilter),
    [activeFilter],
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="grid min-h-[calc(100vh-3.5rem)] min-w-0 xl:grid-cols-[220px_minmax(0,1fr)_286px]">
        <aside className="border-b border-border bg-surface-subtle/35 xl:border-b-0 xl:border-r">
          <div className="flex h-12 items-center justify-between border-b border-border px-3">
            <span className="soc-eyebrow">Priority queue</span>
            <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <PriorityQueue items={incidentQueue} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="border-t border-border p-3"><DetailLink>View all incidents</DetailLink></div>
        </aside>

        <section className="min-w-0 border-b border-border xl:border-b-0 xl:border-r">
          <header className="border-b border-border px-4 py-4 lg:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><SeverityBadge severity={selected.severity} /><span className="font-mono text-xs text-muted-foreground">{selected.id}</span></div>
                <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground">{selected.title}</h1>
                <div className="mt-3 flex flex-wrap gap-x-7 gap-y-2 text-xs">
                  <span><span className="soc-label mr-2">Status</span><StatusLabel>{selected.status}</StatusLabel></span>
                  <span><span className="soc-label mr-2">First seen</span><span className="font-mono text-muted-foreground">Jul 20, 13:58:41</span></span>
                  <span><span className="soc-label mr-2">Owner</span><span className="text-muted-foreground">Unassigned</span></span>
                </div>
              </div>
              <Button size="sm" variant="secondary">Open full case <ExternalLink aria-hidden="true" /></Button>
            </div>
            <div className="soc-scrollbar -mb-4 mt-4 flex overflow-x-auto">
              {tabs.map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={cn("shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition", activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab}</button>
              ))}
            </div>
          </header>

          <div className="px-4 py-4 lg:px-5">
            <div className="border-b border-border pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-primary"><span className="flex size-7 items-center justify-center rounded-full bg-primary/12"><Bot className="size-4" /></span><span className="soc-eyebrow text-primary">Argus attack narrative</span></div>
                <button type="button" className="flex items-center gap-1.5 text-[11px] text-primary"><RefreshCw className="size-3" /> Regenerate</button>
              </div>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">
                Argus detected a suspicious interactive login for <span className="font-mono text-foreground">jsmith</span> from an unusual location, followed by encoded PowerShell execution. The process accessed <span className="font-mono text-foreground">lsass.exe</span> memory, consistent with credential dumping (T1003.001). Subsequent activity shows lateral movement to two hosts via ADMIN$ and PowerShell Remoting.
              </p>
            </div>
            <div className="flex flex-col gap-3 border-b border-border py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {filters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={cn("rounded-control border px-2.5 py-1.5 text-xs transition", activeFilter === filter ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{filter}</button>)}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><span>Show benign events</span><input type="checkbox" className="accent-primary" /></label>
            </div>
            <EventTimeline events={events} />
          </div>
        </section>

        <aside className="soc-scrollbar bg-surface-subtle/25 xl:max-h-[calc(100vh-3.5rem)] xl:overflow-y-auto">
          <Panel title="Affected entities" className="m-3 mb-2 shadow-none">
            <div className="grid grid-cols-3 border-b border-border text-center">
              {[{ icon: Laptop, value: "3", label: "Hosts" }, { icon: UserRound, value: "1", label: "User" }, { icon: Network, value: "2", label: "IPs" }].map(({ icon: Icon, value, label }) => <div key={label} className="border-r border-border px-2 py-3 last:border-r-0"><Icon className="mx-auto size-4 text-muted-foreground" /><p className="mt-1 text-sm font-semibold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>)}
            </div>
            <div className="space-y-2 p-3 text-xs">
              <div className="flex items-center justify-between gap-2"><span className="font-mono">WIN-7F3G2K9H8</span><StatusLabel tone="red">High</StatusLabel></div>
              <div className="flex items-center justify-between gap-2"><span className="font-mono">jsmith@corp</span><StatusLabel tone="red">High</StatusLabel></div>
              <DetailLink>View all entities</DetailLink>
            </div>
          </Panel>
          <Panel title="MITRE ATT&CK mapping" className="m-3 my-2 shadow-none">
            <div className="divide-y divide-border">
              {mitreMappings.map(([id, label, severity]) => <div key={id} className="flex items-start gap-2 px-3 py-2.5"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-high" /><span className="font-mono text-[10px] text-primary">{id}</span><span className="text-[11px] leading-snug text-muted-foreground">{label}</span><span className="sr-only">{severity}</span></div>)}
            </div>
          </Panel>
          <Panel title="Evidence confidence" className="m-3 my-2 shadow-none"><div className="p-4"><ConfidenceMeter value={86} /></div></Panel>
          <ApprovalCard />
        </aside>
      </div>
    </div>
  );
}

