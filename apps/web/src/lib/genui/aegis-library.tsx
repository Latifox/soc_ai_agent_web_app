"use client";

/**
 * Aegis generative-UI component library for OpenUI.
 *
 * The Argus agents reply in OpenUI Lang composed ONLY from these registered
 * components (safe by default — no arbitrary HTML), streamed live into the chat.
 * See docs/09-chat-generative-ui.md. Generate the model system-prompt from this
 * library with `pnpx @openuidev/cli gen-prompt`.
 */

import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { z } from "zod";

import { cn } from "@/lib/utils";

const SEVERITY = {
  low: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  high: "text-red-600 bg-red-500/10 border-red-500/20",
  critical: "text-red-700 bg-red-600/15 border-red-600/30",
} as const;

const STATUS = {
  open: "text-violet-600 bg-violet-500/10",
  in_progress: "text-amber-600 bg-amber-500/10",
  resolved: "text-emerald-600 bg-emerald-500/10",
} as const;

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

const AlertCard = defineComponent({
  name: "AlertCard",
  description: "A security alert/incident summary with severity, host, user, status.",
  props: z.object({
    title: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    host: z.string().optional(),
    user: z.string().optional(),
    detectedAt: z.string(),
    status: z.enum(["open", "in_progress", "resolved"]),
    summary: z.string().optional(),
  }),
  render: (p) => (
    <div className={cn("rounded-xl border-l-[3px] border bg-card p-4 shadow-sm", SEVERITY[p.severity])}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
        <Pill className={STATUS[p.status]}>{p.status.replace("_", " ")}</Pill>
      </div>
      {p.summary && <p className="mt-1 text-sm text-muted-foreground">{p.summary}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Severity: <b className="uppercase">{p.severity}</b></span>
        {p.host && <span>Host: <code>{p.host}</code></span>}
        {p.user && <span>User: <code>{p.user}</code></span>}
        <span>Detected: {p.detectedAt}</span>
      </div>
    </div>
  ),
});

const MitreMappingTable = defineComponent({
  name: "MitreMappingTable",
  description: "Maps observed activity to MITRE ATT&CK tactics/techniques with evidence.",
  props: z.object({
    rows: z.array(
      z.object({ tactic: z.string(), technique: z.string(), id: z.string(), evidence: z.string() }),
    ),
  }),
  render: (p) => (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr><th className="px-3 py-2">Tactic</th><th className="px-3 py-2">Technique</th><th className="px-3 py-2">ID</th><th className="px-3 py-2">Evidence</th></tr>
        </thead>
        <tbody>
          {p.rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-2">{r.tactic}</td>
              <td className="px-3 py-2">{r.technique}</td>
              <td className="px-3 py-2"><code className="text-violet-600">{r.id}</code></td>
              <td className="px-3 py-2 text-muted-foreground">{r.evidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
});

const InvestigationTimeline = defineComponent({
  name: "InvestigationTimeline",
  description: "Chronological incident events (timestamp, actor, action).",
  props: z.object({
    events: z.array(z.object({ ts: z.string(), actor: z.string(), action: z.string() })),
  }),
  render: (p) => (
    <ol className="relative ml-3 border-l pl-4">
      {p.events.map((e, i) => (
        <li key={i} className="mb-3">
          <span className="absolute -left-[5px] mt-1 h-2 w-2 rounded-full bg-violet-500" />
          <div className="text-xs text-muted-foreground">{e.ts}</div>
          <div className="text-sm"><b>{e.actor}</b> — {e.action}</div>
        </li>
      ))}
    </ol>
  ),
});

const RuleDiff = defineComponent({
  name: "RuleDiff",
  description: "A proposed detection rule (YAML) with an Apply action (Vibe Detection).",
  props: z.object({ ruleId: z.string().optional(), yaml: z.string() }),
  render: (p) => (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Proposed rule{p.ruleId ? ` · ${p.ruleId}` : ""}</span>
        <button
          className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
          onClick={() => window.dispatchEvent(new CustomEvent("aegis:apply-rule", { detail: p }))}
        >
          Apply
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed"><code>{p.yaml}</code></pre>
    </div>
  ),
});

const ApprovalPrompt = defineComponent({
  name: "ApprovalPrompt",
  description: "Approve or deny a destructive SOAR action pending human confirmation.",
  props: z.object({
    runId: z.string(),
    toolName: z.string(),
    args: z.record(z.any()),
    risk: z.enum(["low", "medium", "high"]),
  }),
  render: (p) => (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="text-sm font-semibold">Approval required — {p.toolName}</div>
      <pre className="mt-1 overflow-x-auto text-xs text-muted-foreground"><code>{JSON.stringify(p.args, null, 2)}</code></pre>
      <div className="mt-3 flex gap-2">
        <button
          className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
          onClick={() => window.dispatchEvent(new CustomEvent("aegis:approval", { detail: { ...p, decision: "approve" } }))}
        >
          Approve
        </button>
        <button
          className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted"
          onClick={() => window.dispatchEvent(new CustomEvent("aegis:approval", { detail: { ...p, decision: "deny" } }))}
        >
          Deny
        </button>
      </div>
    </div>
  ),
});

export const aegisLibrary = createLibrary({
  components: [AlertCard, MitreMappingTable, InvestigationTimeline, RuleDiff, ApprovalPrompt],
});
