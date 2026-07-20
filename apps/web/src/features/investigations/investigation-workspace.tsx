"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(incidentQueue[0].id);
  const [activeTab, setActiveTab] = useState("Attack story");
  const [activeFilter, setActiveFilter] = useState("All");
  const [showBenign, setShowBenign] = useState(false);
  const [regeneratedAt, setRegeneratedAt] = useState("");
  const [approvalState, setApprovalState] = useState<"pending" | "approved" | "rejected">("pending");
  const [notes, setNotes] = useState("");
  const selected = incidentQueue.find((incident) => incident.id === selectedId) ?? incidentQueue[0];
  const eventSource = useMemo(
    () => showBenign
      ? [...investigationEvents, { time: "14:15:44", category: "Network" as const, title: "Expected DNS query", detail: "Known updater domain matched allowlist.", entity: "workstation-23", severity: "low" as const }]
      : investigationEvents,
    [showBenign],
  );
  const events = useMemo(
    () => activeFilter === "All" ? eventSource : eventSource.filter((event) => event.category === activeFilter),
    [activeFilter, eventSource],
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
          <div className="border-t border-border p-3"><DetailLink onClick={() => router.push("/incidents")}>View all incidents</DetailLink></div>
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
              <Button size="sm" variant="secondary" onClick={() => router.push("/cases")}>Open full case <ExternalLink aria-hidden="true" /></Button>
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
                <button type="button" onClick={() => setRegeneratedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))} className="flex items-center gap-1.5 text-[11px] text-primary"><RefreshCw className="size-3" /> Regenerate</button>
              </div>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">
                Argus detected a suspicious interactive login for <span className="font-mono text-foreground">jsmith</span> from an unusual location, followed by encoded PowerShell execution. The process accessed <span className="font-mono text-foreground">lsass.exe</span> memory, consistent with credential dumping (T1003.001). Subsequent activity shows lateral movement to two hosts via ADMIN$ and PowerShell Remoting.
              </p>
              {regeneratedAt ? <p className="mt-2 text-[11px] text-primary">Narrative regenerated at {regeneratedAt}.</p> : null}
            </div>
            <div className="flex flex-col gap-3 border-b border-border py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {filters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={cn("rounded-control border px-2.5 py-1.5 text-xs transition", activeFilter === filter ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{filter}</button>)}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><span>Show benign events</span><input type="checkbox" checked={showBenign} onChange={(event) => setShowBenign(event.target.checked)} className="accent-primary" /></label>
            </div>
            {activeTab === "Graph" ? (
              <div className="grid gap-3 pt-4 md:grid-cols-3">
                {["jsmith -> WIN-7F3G2K9H8", "WIN-7F3G2K9H8 -> WIN-4XJ2L7D3", "WIN-4XJ2L7D3 -> SRV-2M9P8Q1"].map((edge) => (
                  <div key={edge} className="soc-inset p-4"><p className="soc-label">Relationship</p><p className="mt-2 font-mono text-xs">{edge}</p><StatusLabel tone="amber">Observed</StatusLabel></div>
                ))}
              </div>
            ) : activeTab.startsWith("Evidence") ? (
              <div className="grid gap-3 pt-4 md:grid-cols-2">
                {events.slice(0, 4).map((event) => (
                  <div key={`${event.time}-${event.title}`} className="soc-inset p-4"><p className="soc-label">{event.category} evidence</p><h3 className="mt-2 text-sm font-semibold">{event.title}</h3><p className="mt-1 text-xs text-muted-foreground">{event.detail}</p></div>
                ))}
              </div>
            ) : activeTab.startsWith("Correlations") ? (
              <div className="space-y-2 pt-4">
                {["Same user triggered MFA fatigue rule 18m earlier", "Two hosts share ADMIN$ access path", "Payload hash appears in one prior tenant alert"].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-control border border-border px-3 py-2 text-sm"><span>{item}</span><StatusLabel tone="violet">Linked</StatusLabel></div>
                ))}
              </div>
            ) : activeTab.startsWith("Notes") ? (
              <div className="pt-4">
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add analyst notes..." className="min-h-40 w-full rounded-card border border-border bg-surface p-3 text-sm outline-none focus:border-primary" />
                <p className="mt-2 text-xs text-muted-foreground">{notes.length} characters saved locally.</p>
              </div>
            ) : (
              <EventTimeline events={events} />
            )}
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
              <DetailLink onClick={() => router.push("/assets")}>View all entities</DetailLink>
            </div>
          </Panel>
          <Panel title="MITRE ATT&CK mapping" className="m-3 my-2 shadow-none">
            <div className="divide-y divide-border">
              {mitreMappings.map(([id, label, severity]) => <div key={id} className="flex items-start gap-2 px-3 py-2.5"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-high" /><span className="font-mono text-[10px] text-primary">{id}</span><span className="text-[11px] leading-snug text-muted-foreground">{label}</span><span className="sr-only">{severity}</span></div>)}
            </div>
          </Panel>
          <Panel title="Evidence confidence" className="m-3 my-2 shadow-none"><div className="p-4"><ConfidenceMeter value={86} /></div></Panel>
          <ApprovalCard status={approvalState} onApprove={() => setApprovalState("approved")} onReject={() => setApprovalState("rejected")} />
        </aside>
      </div>
    </div>
  );
}
