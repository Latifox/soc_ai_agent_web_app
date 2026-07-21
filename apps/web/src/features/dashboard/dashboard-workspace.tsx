"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Plus,
  ShieldAlert,
  Siren,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DetailLink,
  MetricStrip,
  Panel,
  PriorityQueue,
  SeverityBadge,
  StatusLabel,
  WorkspaceTitle,
} from "@/components/soc/flagship-ui";
import { cn } from "@/lib/utils";
import type { WorkspaceMetric } from "@/lib/workspace-data";
import type { QueueItem } from "@/components/soc/flagship-ui";

interface DashboardWorkspaceProps {
  metrics: WorkspaceMetric[];
  queue: QueueItem[];
}

const attention = [
  { title: "Containment approval", detail: "Isolate WIN-7F3G2K9H8", age: "2m", tone: "red" as const },
  { title: "Low-confidence triage", detail: "Impossible travel · j.miller", age: "11m", tone: "amber" as const },
  { title: "Case nearing SLA", detail: "CASE-2026-0418 · 18m remaining", age: "42m", tone: "amber" as const },
  { title: "Connector issue", detail: "Okta ingestion delayed", age: "1h", tone: "neutral" as const },
];

const agentActivity = [
  { name: "Triage", task: "Correlating 8 alerts", state: "Running", icon: Activity },
  { name: "Investigation", task: "Mapping lateral movement", state: "Running", icon: ShieldAlert },
  { name: "Threat Intel", task: "Enriching 14 indicators", state: "Running", icon: Siren },
  { name: "Response", task: "Waiting for approval", state: "Paused", icon: Bot },
];

const ranges = ["Last 24 hours", "Last 7 days", "Last 30 days"];

export function DashboardWorkspace({ metrics, queue }: DashboardWorkspaceProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(queue[0]?.id ?? "");
  const [rangeIndex, setRangeIndex] = useState(0);
  const [selectedAttention, setSelectedAttention] = useState(attention[0].title);
  const [notice, setNotice] = useState("");
  const selected = queue.find((item) => item.id === selectedId) ?? queue[0];
  const range = ranges[rangeIndex];

  if (!selected) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-muted-foreground">
        No incidents yet — connect an integration or enable a rule to begin.
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle
        eyebrow="Aegis command center · Live"
        title="Security operations overview"
        description="Prioritized risk, active investigations, and decisions that need your attention."
        actions={<><Button variant="secondary" size="sm" onClick={() => setRangeIndex((value) => (value + 1) % ranges.length)}><Clock3 /> {range}</Button><Button variant="primary" size="sm" onClick={() => router.push("/investigations")}><Plus /> New investigation</Button></>}
      />
      <MetricStrip metrics={metrics} />
      {notice ? (
        <div className="mx-4 mt-4 rounded-control border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary lg:mx-5">{notice}</div>
      ) : null}
      <div className="grid gap-4 p-4 lg:p-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,0.75fr)]">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Panel title="Priority queue" eyebrow="Live incidents" action={<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{queue.length}</span>}>
            <PriorityQueue items={queue} selectedId={selectedId} onSelect={setSelectedId} />
          </Panel>
          <Panel title={selected.title} eyebrow={selected.id} action={<SeverityBadge severity={selected.severity} />}>
            <div className="soc-grid-bg p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/12 text-primary"><Sparkles className="size-4" /></span>
                <div>
                  <p className="soc-eyebrow text-primary">Argus assessment</p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Credential access is highly likely. The login sequence, encoded PowerShell, and LSASS memory access form a coherent attack path with evidence of lateral movement.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[{ label: "Confidence", value: "86%" }, { label: "Affected", value: "3 hosts" }, { label: "Techniques", value: "4 MITRE" }].map((item) => <div key={item.label} className="soc-inset px-3 py-3"><p className="soc-label">{item.label}</p><p className="mt-1 text-sm font-semibold">{item.value}</p></div>)}
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-sm font-medium">Recommended: isolate the source host</p><p className="mt-1 text-xs text-muted-foreground">Human approval required · action fully audited</p></div>
                  <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => router.push(`/investigations?incident=${selected.id}&tab=evidence`)}>Review evidence</Button><Button size="sm" variant="primary" onClick={() => router.push(`/investigations?incident=${selected.id}`)}>Open investigation <ArrowRight /></Button></div>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Needs human attention" eyebrow="4 items">
            <div className="divide-y divide-border">
              {attention.map((item) => <button key={item.title} type="button" onClick={() => { setSelectedAttention(item.title); setNotice(`${item.title} selected for review.`); }} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-primary/[0.035]", selectedAttention === item.title ? "bg-primary/[0.055]" : "")}><span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface"><ShieldAlert className="size-4 text-high" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.detail}</span></span><span className="text-[10px] text-muted-foreground">{item.age}</span><StatusLabel tone={item.tone}>{item.tone === "red" ? "Urgent" : item.tone === "amber" ? "Review" : "Issue"}</StatusLabel></button>)}
            </div>
          </Panel>
          <Panel title="Argus crew" eyebrow="Autonomous operations" action={<StatusLabel tone="green">Operational</StatusLabel>}>
            <div className="divide-y divide-border">
              {agentActivity.map(({ name, task, state, icon: Icon }) => <div key={name} className="flex items-center gap-3 px-4 py-3"><span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{name}</p><p className="truncate text-xs text-muted-foreground">{task}</p></div><StatusLabel tone={state === "Running" ? "green" : "amber"}>{state}</StatusLabel></div>)}
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-3"><span className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-low" /> 128 actions audited today</span><DetailLink onClick={() => router.push("/assistant?context=Argus%20crew")}>Open Argus</DetailLink></div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
