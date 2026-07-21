/**
 * Live data layer — maps real /api/v1 records into the workspace/dashboard view models.
 * Server-only: pages call these and pass the result into client components, so every
 * screen renders backend data (no frontend mocks).
 */

import type { QueueItem, Severity } from "@/components/soc/flagship-ui";
import {
  getAgentsStatus,
  getApprovals,
  getAssets,
  getAutonomyPolicies,
  getCases,
  getIncidents,
  getIntegrations,
  getMetrics,
  getRules,
  getTelemetry,
  type AgentStatus,
  type IncidentRecord,
  type Metrics,
  type TelemetryOverview,
} from "@/lib/api";
import {
  workspaceConfigs,
  type WorkspaceConfig,
  type WorkspaceMetric,
  type WorkspaceRecord,
} from "@/lib/workspace-data";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

function toSeverity(value: string | undefined): Severity {
  return (SEVERITIES as string[]).includes(value ?? "") ? (value as Severity) : "info";
}

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function titleCase(value: string): string {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface AttentionItem {
  title: string;
  detail: string;
  age: string;
  tone: "red" | "amber" | "neutral";
}

export interface IncidentDetail {
  description: string;
  entities: string[];
  tags: string[];
  assignee: string;
  status: string;
  mitre: string[];
  recommended: string;
}

export interface LiveDashboard {
  metrics: WorkspaceMetric[];
  queue: QueueItem[];
  mitre: string[];
  pendingApprovals: number;
  attention: AttentionItem[];
  agents: AgentStatus[];
  details: Record<string, IncidentDetail>;
  telemetry: TelemetryOverview;
}

const RECOMMENDATIONS: Record<string, string> = {
  soar_isolate_host: "Isolate the affected host",
  soar_disable_user: "Suspend the implicated account",
  soar_block_ip: "Block the source IP",
};

export async function liveDashboard(): Promise<LiveDashboard> {
  const [metrics, incidents, approvals, integrations, agents, telemetry] = await Promise.all([
    getMetrics(),
    getIncidents(),
    getApprovals(),
    getIntegrations(),
    getAgentsStatus(),
    getTelemetry(),
  ]);
  const critical = metrics.incidents.by_severity["critical"] ?? 0;
  const high = metrics.incidents.by_severity["high"] ?? 0;
  const pending = approvals.filter((a) => a.status === "pending");

  // Needs-human-attention feed, built from live records.
  const attention: AttentionItem[] = [
    ...pending.map((a) => ({
      title: `Approval: ${titleCase(a.tool_name.replace(/^soar_/, ""))}`,
      detail: Object.values(a.args).map(String).slice(0, 2).join(" · "),
      age: "now",
      tone: "red" as const,
    })),
    ...incidents
      .filter((i) => !i.assignee && i.status === "open")
      .map((i) => ({
        title: "Unassigned incident",
        detail: i.title,
        age: timeAgo(i.detected_at ?? i.created_at),
        tone: "amber" as const,
      })),
    ...integrations
      .filter((i) => i.status === "error")
      .map((i) => ({
        title: "Connector issue",
        detail: `${i.name} is in error`,
        age: "—",
        tone: "neutral" as const,
      })),
  ];

  // Per-incident detail for the assessment panel (keyed like the queue ids).
  const details: Record<string, IncidentDetail> = {};
  for (const incident of incidents) {
    const key = incident.id.slice(0, 8).toUpperCase();
    const entityHit = pending.find((a) =>
      Object.values(a.args).some((v) => incident.entities?.includes(String(v))),
    );
    details[key] = {
      description: incident.description ?? "No description recorded for this incident.",
      entities: incident.entities ?? [],
      tags: incident.tags ?? [],
      assignee: incident.assignee ?? "Unassigned",
      status: titleCase(incident.status),
      mitre: (incident.tags ?? []).filter((t) => /^T1\d{3}/i.test(t)),
      recommended: entityHit
        ? `${RECOMMENDATIONS[entityHit.tool_name] ?? entityHit.tool_name} (approval pending)`
        : incident.status === "resolved"
          ? "Resolved — no action required"
          : "Continue investigation",
    };
  }

  const eventsMetric: WorkspaceMetric = telemetry.available
    ? { label: "Events (24h)", value: compact(telemetry.total_events), detail: "live from ClickHouse", tone: "violet" }
    : { label: "Enabled rules", value: String(metrics.rules.enabled), detail: `${metrics.rules.mitre_techniques.length} MITRE techniques`, tone: "violet" };

  return {
    metrics: [
      { label: "Open incidents", value: String(metrics.incidents.open), detail: `${metrics.incidents.total} total`, tone: metrics.incidents.open ? "red" : "green" },
      { label: "Critical / High", value: `${critical} / ${high}`, detail: "open severity mix", tone: critical + high ? "red" : "green" },
      eventsMetric,
      { label: "Pending approvals", value: String(metrics.approvals.pending), detail: "awaiting analyst", tone: metrics.approvals.pending ? "amber" : "green" },
    ],
    queue: incidentQueueItems(incidents),
    mitre: metrics.rules.mitre_techniques,
    pendingApprovals: metrics.approvals.pending,
    attention,
    agents: agents.agents,
    details,
    telemetry,
  };
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function incidentQueueItems(incidents: IncidentRecord[]): QueueItem[] {
  return [...incidents]
    .sort((a, b) => (b.detected_at ?? "").localeCompare(a.detected_at ?? ""))
    .map((incident) => ({
      id: incident.id.slice(0, 8).toUpperCase(),
      title: incident.title,
      entity: incident.entities?.[0] ?? incident.assignee ?? "—",
      time: timeAgo(incident.detected_at ?? incident.created_at),
      severity: toSeverity(incident.severity),
      status: titleCase(incident.status),
    }));
}

// ── Investigations ───────────────────────────────────────────────────────────

import type { TimelineItem } from "@/components/soc/flagship-ui";

function toTimeline(incident: IncidentRecord): TimelineItem[] {
  const ts = incident.detected_at ?? incident.created_at;
  const clock = ts ? new Date(ts).toLocaleTimeString("en-GB", { hour12: false }) : "—";
  const items: TimelineItem[] = [
    {
      time: clock,
      category: "Process",
      title: incident.rule_title ?? incident.title,
      detail: incident.description ?? "Detection fired.",
      entity: incident.entities?.[0] ?? "—",
      severity: toSeverity(incident.severity),
    },
  ];
  for (const entity of incident.entities?.slice(1) ?? []) {
    items.push({
      time: clock,
      category: entity.includes(".") && /\d/.test(entity) ? "Network" : "Identity",
      title: `Related entity observed`,
      detail: `${entity} appears in the correlated detections for this incident.`,
      entity,
      severity: "medium",
    });
  }
  return items;
}

export interface InvestigationDetail {
  narrative: string;
  entities: string[];
  hosts: number;
  users: number;
  ips: number;
  mitre: string[];
  correlations: string[];
  graphEdges: string[];
  confidence: number;
  recommended: string;
  approvalId?: string;
  approvalTitle: string;
  approvalSummary: string;
  approvalSteps: string[];
  evidenceCaption: string;
}

export interface LiveInvestigation {
  queue: QueueItem[];
  timelines: Record<string, TimelineItem[]>;
  details: Record<string, InvestigationDetail>;
  mitre: string[];
}

const CONFIDENCE: Record<string, number> = { critical: 94, high: 86, medium: 71, low: 58, info: 40 };
const IP_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export async function liveInvestigation(): Promise<LiveInvestigation> {
  const [incidents, metrics, approvals] = await Promise.all([getIncidents(), getMetrics(), getApprovals()]);
  const queue = incidentQueueItems(incidents);
  const timelines: Record<string, TimelineItem[]> = {};
  const details: Record<string, InvestigationDetail> = {};
  const pending = approvals.filter((a) => a.status === "pending");

  for (const incident of incidents) {
    const key = incident.id.slice(0, 8).toUpperCase();
    timelines[key] = toTimeline(incident);
    const entities = incident.entities ?? [];
    const ips = entities.filter((e) => IP_RE.test(e));
    const users = entities.filter((e) => !IP_RE.test(e) && !/[-]|WIN|SRV|DC|HOST/i.test(e));
    const hosts = entities.filter((e) => !ips.includes(e) && !users.includes(e));
    const edges = entities.slice(0, -1).map((e, i) => `${e} -> ${entities[i + 1]}`);
    const correlations = incidents
      .filter((o) => o.id !== incident.id)
      .filter((o) => (o.entities ?? []).some((e) => entities.includes(e)) || (o.tags ?? []).some((t) => incident.tags?.includes(t)))
      .slice(0, 3)
      .map((o) => `Shares ${(o.entities ?? []).find((e) => entities.includes(e)) ? "an entity" : "a technique"} with "${o.title}"`);
    const approval = pending.find((a) => Object.values(a.args).some((v) => entities.includes(String(v))));
    const eventsCount = timelines[key].length;
    details[key] = {
      narrative: incident.description ?? "No Argus narrative recorded for this incident yet.",
      entities,
      hosts: hosts.length,
      users: users.length,
      ips: ips.length,
      mitre: (incident.tags ?? []).filter((t) => /^T1\d{3}/i.test(t)),
      correlations,
      graphEdges: edges.length ? edges : entities.map((e) => `${e} (isolated)`),
      confidence: CONFIDENCE[incident.severity] ?? 60,
      recommended: approval
        ? `${titleCase(approval.tool_name.replace(/^soar_/, ""))} — approval pending`
        : incident.status === "resolved"
          ? "Resolved — no action required"
          : "Continue investigation and enrich indicators",
      approvalId: approval?.id,
      approvalTitle: approval ? titleCase(approval.tool_name.replace(/^soar_/, "")) : "Continue investigation",
      approvalSummary: approval
        ? "Destructive action — requires human approval, fully audited before execution."
        : incident.status === "resolved"
          ? "Incident resolved. No action pending."
          : "No destructive action pending. Continue enriching the investigation.",
      approvalSteps: approval
        ? Object.entries(approval.args).map(([k, v]) => `${titleCase(k)}: ${v}`)
        : [],
      evidenceCaption: `${eventsCount} evidence event${eventsCount === 1 ? "" : "s"} from correlated detections (${incident.severity} severity).`,
    };
  }
  return { queue, timelines, details, mitre: metrics.rules.mitre_techniques };
}

// ── Workspaces ───────────────────────────────────────────────────────────────

export async function liveRulesConfig(): Promise<WorkspaceConfig> {
  const [rules, metrics] = await Promise.all([getRules(), getMetrics()]);
  const records: WorkspaceRecord[] = rules.map((rule) => ({
    id: rule.id.slice(0, 8).toUpperCase(),
    primary: rule.title,
    secondary: rule.tags.slice(0, 3).join(" · ") || rule.type,
    severity: toSeverity(rule.severity),
    source: titleCase(rule.type),
    updated: timeAgo(rule.updated_at ?? rule.created_at),
    status: rule.enabled ? "Enabled" : "Disabled",
    owner: rule.author ?? "—",
    description: rule.yaml.split("\n").slice(0, 3).join(" "),
  }));
  return {
    ...workspaceConfigs.rules,
    records,
    metrics: [
      { label: "Total rules", value: String(metrics.rules.total), detail: `${metrics.rules.enabled} enabled`, tone: "violet" },
      { label: "MITRE coverage", value: String(metrics.rules.mitre_techniques.length), detail: "techniques", tone: "green" },
      { label: "Disabled", value: String(metrics.rules.total - metrics.rules.enabled), detail: "needs review", tone: metrics.rules.total - metrics.rules.enabled ? "amber" : "green" },
      { label: "Open incidents", value: String(metrics.incidents.open), detail: "fired from rules", tone: metrics.incidents.open ? "red" : "green" },
    ],
    context: [
      { label: "Enabled", value: String(metrics.rules.enabled), tone: "green" },
      { label: "Techniques", value: metrics.rules.mitre_techniques.slice(0, 4).join(", ") || "—", tone: "violet" },
      { label: "Authors", value: String(new Set(rules.map((r) => r.author)).size), tone: "neutral" },
    ],
  };
}

export async function liveCasesConfig(): Promise<WorkspaceConfig> {
  const [cases, metrics] = await Promise.all([getCases(), getMetrics()]);
  const records: WorkspaceRecord[] = cases.map((c) => ({
    id: c.code ?? c.id.slice(0, 8).toUpperCase(),
    primary: `${c.code ?? ""} — ${c.title}`.replace(/^ — /, ""),
    secondary: c.tags.slice(0, 3).join(" · ") || "—",
    severity: c.status === "closed" ? "info" : "high",
    source: c.assignee ?? "Unassigned",
    updated: timeAgo(c.created_at),
    status: titleCase(c.status),
    owner: c.assignee ?? "Queue",
    description: c.description ?? "",
  }));
  return {
    ...workspaceConfigs.cases,
    records,
    metrics: [
      { label: "Open cases", value: String(metrics.cases.open), detail: `${metrics.cases.total} total`, tone: metrics.cases.open ? "amber" : "green" },
      { label: "Closed", value: String(metrics.cases.total - metrics.cases.open), detail: "resolved", tone: "green" },
      { label: "Comments", value: String(cases.reduce((n, c) => n + (c.comments?.length ?? 0), 0)), detail: "collaboration", tone: "violet" },
      { label: "Unassigned", value: String(cases.filter((c) => !c.assignee).length), detail: "needs owner", tone: "amber" },
    ],
    context: [
      { label: "Open", value: String(metrics.cases.open), tone: "amber" },
      { label: "By Argus", value: String(cases.filter((c) => c.comments?.some((x) => x.author === "argus")).length), tone: "violet" },
      { label: "Closed", value: String(metrics.cases.total - metrics.cases.open), tone: "green" },
    ],
  };
}

export async function liveAssetsConfig(): Promise<WorkspaceConfig> {
  const [assets, metrics] = await Promise.all([getAssets(), getMetrics()]);
  const records: WorkspaceRecord[] = assets.map((asset) => ({
    id: asset.id.slice(0, 8).toUpperCase(),
    primary: asset.name,
    secondary: Object.entries(asset.attributes).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ") || titleCase(asset.kind),
    severity: asset.risk_score >= 80 ? "critical" : asset.risk_score >= 60 ? "high" : asset.risk_score >= 40 ? "medium" : "low",
    source: titleCase(asset.kind),
    updated: `risk ${asset.risk_score}`,
    status: titleCase(asset.criticality),
    owner: String(asset.attributes["owner"] ?? asset.attributes["dept"] ?? "—"),
    description: `Risk score ${asset.risk_score} · criticality ${asset.criticality}`,
  }));
  return {
    ...workspaceConfigs.assets,
    records,
    metrics: [
      { label: "Known assets", value: String(metrics.assets.total), detail: "inventory", tone: "violet" },
      { label: "High risk", value: String(metrics.assets.high_risk), detail: "risk ≥ 70", tone: metrics.assets.high_risk ? "red" : "green" },
      { label: "Hosts", value: String(assets.filter((a) => a.kind === "host").length), detail: "endpoints/servers" },
      { label: "Identities", value: String(assets.filter((a) => a.kind === "user").length), detail: "users/services", tone: "amber" },
    ],
    context: [
      { label: "Critical", value: String(assets.filter((a) => a.criticality === "critical").length), tone: "red" },
      { label: "High risk", value: String(metrics.assets.high_risk), tone: "amber" },
      { label: "Kinds", value: String(new Set(assets.map((a) => a.kind)).size), tone: "violet" },
    ],
  };
}

export async function liveAutomationConfig(): Promise<WorkspaceConfig> {
  const [approvals, policies] = await Promise.all([getApprovals(), getAutonomyPolicies()]);
  const records: WorkspaceRecord[] = approvals.map((approval) => ({
    id: approval.run_id.toUpperCase(),
    primary: titleCase(approval.tool_name.replace(/^soar_/, "")),
    secondary: Object.entries(approval.args).map(([k, v]) => `${k}: ${v}`).slice(0, 2).join(" · "),
    severity: approval.status === "pending" ? "high" : "info",
    source: "Argus response",
    updated: titleCase(approval.status),
    status: titleCase(approval.status),
    owner: approval.decided_by ?? "Awaiting analyst",
    description: `Run ${approval.run_id} requested ${approval.tool_name}.`,
  }));
  const auto = policies.filter((p) => p.mode === "auto").length;
  return {
    ...workspaceConfigs.automation,
    records,
    metrics: [
      { label: "Pending approvals", value: String(approvals.filter((a) => a.status === "pending").length), detail: "destructive actions", tone: "red" },
      { label: "Autonomous classes", value: String(auto), detail: `of ${policies.length} action classes`, tone: "violet" },
      { label: "Approval-gated", value: String(policies.filter((p) => p.mode === "approve").length), detail: "human in the loop", tone: "amber" },
      { label: "Denied classes", value: String(policies.filter((p) => p.mode === "deny").length), detail: "kill-switched", tone: "green" },
    ],
    context: policies.map((p) => ({
      label: titleCase(p.action_class),
      value: p.mode.toUpperCase(),
      tone: p.mode === "auto" ? "violet" : p.mode === "approve" ? "amber" : "red",
    })),
  };
}

export async function liveIntegrationsConfig(): Promise<WorkspaceConfig> {
  const [integrations, metrics] = await Promise.all([getIntegrations(), getMetrics()]);
  const records: WorkspaceRecord[] = integrations.map((integration) => ({
    id: integration.id.slice(0, 8).toUpperCase(),
    primary: integration.name,
    secondary: Object.entries(integration.config).slice(0, 2).map(([k, v]) => `${k}: ${Array.isArray(v) ? (v as unknown[]).join(", ") : v}`).join(" · ") || integration.provider,
    severity: integration.status === "error" ? "high" : integration.status === "connected" ? "info" : "low",
    source: titleCase(integration.provider),
    updated: "—",
    status: titleCase(integration.status),
    owner: "Security Eng",
    description: `${integration.name} (${integration.provider}) is ${integration.status}.`,
  }));
  return {
    ...workspaceConfigs.integrations,
    records,
    metrics: [
      { label: "Total integrations", value: String(metrics.integrations.total), detail: "configured", tone: "violet" },
      { label: "Connected", value: String(metrics.integrations.connected), detail: "healthy", tone: "green" },
      { label: "Issues", value: String(metrics.integrations.issues), detail: "in error", tone: metrics.integrations.issues ? "red" : "green" },
      { label: "Disconnected", value: String(metrics.integrations.total - metrics.integrations.connected - metrics.integrations.issues), detail: "not configured", tone: "amber" },
    ],
    context: [
      { label: "Connected", value: String(metrics.integrations.connected), tone: "green" },
      { label: "Errors", value: String(metrics.integrations.issues), tone: metrics.integrations.issues ? "red" : "neutral" },
      { label: "Providers", value: String(new Set(integrations.map((i) => i.provider)).size), tone: "violet" },
    ],
  };
}

export async function liveReportsConfig(): Promise<WorkspaceConfig> {
  const metrics = await getMetrics();
  const resolved = metrics.incidents.by_status["resolved"] ?? 0;
  const records: WorkspaceRecord[] = [
    { id: "RPT-OPS", primary: "SOC operational summary", secondary: `${metrics.incidents.open} open / ${metrics.incidents.total} total incidents`, severity: metrics.incidents.open ? "high" : "info", source: "Live metrics", updated: "now", status: "Ready", owner: "SOC", description: "Computed from the live incident store." },
    { id: "RPT-MITRE", primary: "MITRE coverage review", secondary: `${metrics.rules.mitre_techniques.length} techniques across ${metrics.rules.enabled} enabled rules`, severity: "medium", source: "Live metrics", updated: "now", status: "Ready", owner: "Detection", description: metrics.rules.mitre_techniques.join(", ") || "No technique tags yet." },
    { id: "RPT-AUTO", primary: "Argus autonomy audit", secondary: `${metrics.approvals.pending} approvals pending`, severity: metrics.approvals.pending ? "high" : "info", source: "Live metrics", updated: "now", status: "Ready", owner: "Compliance", description: "Approvals and autonomy policy state." },
    { id: "RPT-ASSET", primary: "Asset risk report", secondary: `${metrics.assets.high_risk} high-risk of ${metrics.assets.total} assets`, severity: metrics.assets.high_risk ? "medium" : "info", source: "Live metrics", updated: "now", status: "Ready", owner: "SOC", description: "Entity risk distribution." },
  ];
  return {
    ...workspaceConfigs.reports,
    records,
    metrics: [
      { label: "Open incidents", value: String(metrics.incidents.open), detail: `${metrics.incidents.total} total`, tone: metrics.incidents.open ? "red" : "green" },
      { label: "Resolved", value: String(resolved), detail: "closed out", tone: "green" },
      { label: "MITRE techniques", value: String(metrics.rules.mitre_techniques.length), detail: "covered", tone: "violet" },
      { label: "Pending approvals", value: String(metrics.approvals.pending), detail: "awaiting decision", tone: metrics.approvals.pending ? "amber" : "green" },
    ],
    context: [
      { label: "Cases open", value: String(metrics.cases.open), tone: "amber" },
      { label: "Integrations healthy", value: `${metrics.integrations.connected}/${metrics.integrations.total}`, tone: "green" },
      { label: "High-risk assets", value: String(metrics.assets.high_risk), tone: "red" },
    ],
  };
}

export async function liveConfigurationsConfig(): Promise<WorkspaceConfig> {
  const [policies, integrations] = await Promise.all([getAutonomyPolicies(), getIntegrations()]);
  const records: WorkspaceRecord[] = policies.map((policy) => ({
    id: policy.id.slice(0, 8).toUpperCase(),
    primary: `Autonomy — ${titleCase(policy.action_class)}`,
    secondary: `mode: ${policy.mode}`,
    severity: policy.mode === "auto" ? "medium" : policy.mode === "approve" ? "low" : "info",
    source: "Autonomy policy",
    updated: "live",
    status: policy.mode.toUpperCase(),
    owner: "Admin",
    description: `Response class ${policy.action_class} runs in ${policy.mode} mode.`,
  }));
  return {
    ...workspaceConfigs.configurations,
    records,
    metrics: [
      { label: "Action classes", value: String(policies.length), detail: "governed", tone: "violet" },
      { label: "Autonomous", value: String(policies.filter((p) => p.mode === "auto").length), detail: "no approval needed" },
      { label: "Gated", value: String(policies.filter((p) => p.mode === "approve").length), detail: "HITL", tone: "amber" },
      { label: "Sources", value: String(integrations.length), detail: "integrations", tone: "green" },
    ],
    context: [
      { label: "Kill-switch", value: policies.every((p) => p.mode === "deny") ? "ACTIVE" : "off", tone: "neutral" },
      { label: "Gated classes", value: String(policies.filter((p) => p.mode === "approve").length), tone: "amber" },
      { label: "Auto classes", value: String(policies.filter((p) => p.mode === "auto").length), tone: "violet" },
    ],
  };
}

export async function liveSettingsConfig(): Promise<WorkspaceConfig> {
  const [metrics, policies] = await Promise.all([getMetrics(), getAutonomyPolicies()]);
  const records: WorkspaceRecord[] = [
    { id: "TENANT", primary: "Tenant — Demo Org", secondary: "plan: dev · region: local", severity: "info", source: "Supabase", updated: "live", status: "Active", owner: "Admin", description: "Tenant configuration and retention." },
    { id: "AUTH", primary: "Authentication — Supabase Auth", secondary: "password + magic link · MFA available", severity: "info", source: "Supabase", updated: "live", status: "Enabled", owner: "Admin", description: "SSO/SAML and SCIM configurable per tenant." },
    { id: "AGENTS", primary: "Argus agent crew", secondary: `${policies.length} action classes governed`, severity: "low", source: "AgentOS", updated: "live", status: "Running", owner: "Argus", description: "Autonomous SOC crew with HITL approvals." },
    { id: "DATA", primary: "Data plane", secondary: "ClickHouse (chdb) · OpenSearch · local ./data", severity: "info", source: "Aegis core", updated: "live", status: "Local-first", owner: "Platform", description: "Local-first dev; server backends in prod." },
  ];
  return {
    ...workspaceConfigs.settings,
    records,
    metrics: [
      { label: "Integrations", value: String(metrics.integrations.total), detail: `${metrics.integrations.connected} connected`, tone: "violet" },
      { label: "Rules", value: String(metrics.rules.total), detail: `${metrics.rules.enabled} enabled`, tone: "green" },
      { label: "Assets", value: String(metrics.assets.total), detail: "inventoried" },
      { label: "Approvals pending", value: String(metrics.approvals.pending), detail: "HITL queue", tone: metrics.approvals.pending ? "amber" : "green" },
    ],
    context: [
      { label: "Environment", value: "dev (local-first)", tone: "neutral" },
      { label: "Storage", value: "./data (no S3)", tone: "neutral" },
      { label: "LLM", value: "Claude via Agno", tone: "violet" },
    ],
  };
}
