"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Bot, Check, CheckCircle2, Loader2, ShieldCheck, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricStrip, Panel, StatusLabel, WorkspaceTitle } from "@/components/soc/flagship-ui";
import { cn } from "@/lib/utils";
import type { AgentStatus, ApprovalRecord, AutonomyPolicy } from "@/lib/api";
import type { WorkspaceMetric } from "@/lib/workspace-data";

type Mode = "auto" | "approve" | "deny";
const ACTION_CLASSES: { key: string; label: string; destructive: boolean; blurb: string }[] = [
  { key: "notify", label: "Notify", destructive: false, blurb: "Send alerts / messages" },
  { key: "ticket", label: "Ticket", destructive: false, blurb: "Open tracking tickets" },
  { key: "block_ip", label: "Block IP", destructive: true, blurb: "Firewall deny a source IP" },
  { key: "isolate_host", label: "Isolate host", destructive: true, blurb: "Quarantine an endpoint" },
  { key: "disable_user", label: "Disable user", destructive: true, blurb: "Suspend an account" },
];
const MODES: { key: Mode; label: string; tone: "green" | "amber" | "red" }[] = [
  { key: "auto", label: "Auto", tone: "green" },
  { key: "approve", label: "Approve", tone: "amber" },
  { key: "deny", label: "Deny", tone: "red" },
];

function defaultMode(destructive: boolean): Mode {
  return destructive ? "approve" : "auto";
}
function titleCase(s: string) {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.status === 204 ? null : resp.json();
}

export function AutomationWorkspace({
  policies: initialPolicies,
  approvals: initialApprovals,
  agents,
  metrics,
}: {
  policies: AutonomyPolicy[];
  approvals: ApprovalRecord[];
  agents: AgentStatus[];
  metrics: WorkspaceMetric[];
}) {
  const router = useRouter();
  const [modes, setModes] = useState<Record<string, Mode>>(() => {
    const m: Record<string, Mode> = {};
    for (const ac of ACTION_CLASSES) m[ac.key] = (initialPolicies.find((p) => p.action_class === ac.key)?.mode as Mode) ?? defaultMode(ac.destructive);
    return m;
  });
  const [approvals, setApprovals] = useState(initialApprovals);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function setMode(actionClass: string, mode: Mode) {
    const prev = modes[actionClass];
    setModes((m) => ({ ...m, [actionClass]: mode }));
    setBusy(actionClass);
    try {
      await backend("autonomy-policies", { method: "PUT", body: JSON.stringify({ action_class: actionClass, mode }) });
      setNotice(`${titleCase(actionClass)} → ${titleCase(mode)}`);
    } catch {
      setModes((m) => ({ ...m, [actionClass]: prev }));
      setNotice("Update failed.");
    } finally {
      setBusy("");
    }
  }

  async function killSwitch() {
    setBusy("kill");
    try {
      await Promise.all(ACTION_CLASSES.filter((a) => a.destructive).map((a) => backend("autonomy-policies", { method: "PUT", body: JSON.stringify({ action_class: a.key, mode: "deny" }) })));
      setModes((m) => { const n = { ...m }; for (const a of ACTION_CLASSES) if (a.destructive) n[a.key] = "deny"; return n; });
      setNotice("Kill-switch engaged — all destructive actions denied.");
    } finally {
      setBusy("");
    }
  }

  async function decide(id: string, decision: "approve" | "deny") {
    setBusy(id);
    try {
      const updated = (await backend(`approvals/${id}`, { method: "POST", body: JSON.stringify({ decision }) })) as ApprovalRecord;
      setApprovals((a) => a.map((x) => (x.id === id ? { ...x, ...updated } : x)));
      setNotice(`Action ${decision === "approve" ? "approved" : "denied"}.`);
    } catch {
      setNotice("Decision failed.");
    } finally {
      setBusy("");
    }
  }

  const pending = approvals.filter((a) => a.status === "pending");
  const decided = approvals.filter((a) => a.status !== "pending");

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle
        eyebrow="Autonomous SOC"
        title="Automation"
        description="Govern what the Response agent may do on its own, and clear the human-approval queue."
        actions={<Button size="sm" variant="danger" onClick={killSwitch} disabled={busy !== ""}>{busy === "kill" ? <Loader2 className="animate-spin" /> : <Ban />} Kill-switch</Button>}
      />
      <MetricStrip metrics={metrics} />
      {notice ? <div className="mx-4 mt-4 rounded-control border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary lg:mx-5">{notice}</div> : null}

      <div className="grid gap-4 p-4 lg:p-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel title="Autonomy policy" eyebrow="Per action class">
          <div className="divide-y divide-border">
            {ACTION_CLASSES.map((ac) => (
              <div key={ac.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-control", ac.destructive ? "bg-high/10 text-high" : "bg-primary/10 text-primary")}>
                  {ac.destructive ? <ShieldCheck className="size-4" /> : <Zap className="size-4" />}
                </span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{ac.label}</p><p className="text-xs text-muted-foreground">{ac.blurb}</p></div>
                <div className="flex overflow-hidden rounded-control border border-border">
                  {MODES.map((m) => (
                    <button key={m.key} type="button" disabled={busy === ac.key} onClick={() => setMode(ac.key, m.key)}
                      className={cn("px-3 py-1.5 text-xs transition", modes[ac.key] === m.key ? (m.tone === "green" ? "bg-low/15 text-low" : m.tone === "amber" ? "bg-medium/15 text-medium" : "bg-high/15 text-high") : "text-muted-foreground hover:text-foreground")}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Auto = agent acts directly · Approve = pauses for a human · Deny = blocked outright.</p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Approval queue" eyebrow="Human-in-the-loop" action={<StatusLabel tone={pending.length ? "amber" : "green"}>{pending.length} pending</StatusLabel>}>
            <div className="divide-y divide-border">
              {pending.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-1 size-5 text-low" /> Nothing awaiting approval.</p> : null}
              {pending.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{titleCase(String(a.tool_name).replace(/^soar_/, ""))}</p>
                    <span className="font-mono text-[10px] text-muted-foreground">run {String(a.run_id).slice(0, 8)}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{Object.entries(a.args ?? {}).map(([k, v]) => `${k}=${v}`).join(" · ")}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="primary" onClick={() => decide(a.id, "approve")} disabled={busy !== ""}>{busy === a.id ? <Loader2 className="animate-spin" /> : <Check />} Approve</Button>
                    <Button size="sm" variant="danger" onClick={() => decide(a.id, "deny")} disabled={busy !== ""}><X /> Deny</Button>
                  </div>
                </div>
              ))}
              {decided.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5 opacity-70">
                  <p className="text-sm">{titleCase(String(a.tool_name).replace(/^soar_/, ""))}</p>
                  <StatusLabel tone={a.status === "approved" ? "green" : "red"}>{titleCase(a.status)}</StatusLabel>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Argus crew" eyebrow="Autonomous operations" action={<StatusLabel tone={agents.length ? "green" : "neutral"}>{agents.length ? "Operational" : "Offline"}</StatusLabel>}>
            <div className="divide-y divide-border">
              {agents.map((ag) => (
                <div key={ag.key} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{ag.name}</p><p className="truncate text-xs text-muted-foreground">{ag.task}</p></div>
                  <StatusLabel tone={ag.state === "running" ? "green" : ag.state === "paused" ? "amber" : "neutral"}>{titleCase(ag.state)}</StatusLabel>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-4 py-3"><button type="button" onClick={() => router.push("/assistant")} className="text-xs text-primary hover:underline">Open Argus →</button></div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
