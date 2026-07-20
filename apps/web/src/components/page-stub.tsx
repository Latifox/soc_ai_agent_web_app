import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Cloud,
  FileCode2,
  KeyRound,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { allNavItems } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import {
  DetailLink,
  MetricStrip,
  Panel,
  SeverityBadge,
  StatusLabel,
  Toolbar,
  WorkspaceTitle,
  type Severity,
} from "@/components/soc/flagship-ui";

interface PageStubProps { href: string }

type Row = { primary: string; secondary: string; severity: Severity; source: string; updated: string; status: string };
type Config = {
  eyebrow: string;
  action: string;
  metrics: Array<{ label: string; value: string; detail: string; tone?: "red" | "green" | "violet" | "amber" }>;
  columns: [string, string, string, string, string];
  rows: Row[];
  contextTitle: string;
  context: Array<{ label: string; value: string; tone?: "green" | "amber" | "red" | "violet" | "neutral" }>;
};

const defaultRows: Row[] = [
  { primary: "Credential Access via LSASS", secondary: "T1003.001 · Windows", severity: "critical", source: "Endpoint", updated: "2m ago", status: "Investigating" },
  { primary: "Impossible Travel", secondary: "T1078 · Identity", severity: "medium", source: "Okta", updated: "18m ago", status: "Open" },
  { primary: "MFA Fatigue / Push Bombing", secondary: "T1621 · Identity", severity: "high", source: "Azure AD", updated: "32m ago", status: "Triage" },
  { primary: "Suspicious PowerShell", secondary: "T1059.001 · Execution", severity: "high", source: "Microsoft Defender", updated: "1h ago", status: "Enabled" },
  { primary: "DNS Tunneling Suspicion", secondary: "T1071.004 · C2", severity: "medium", source: "Cloudflare", updated: "2h ago", status: "Monitoring" },
];

const configs: Record<string, Config> = {
  "/rules": {
    eyebrow: "Detection engineering", action: "New rule",
    metrics: [{ label: "Active rules", value: "118", detail: "6 types", tone: "violet" }, { label: "Coverage", value: "74%", detail: "+6% this month", tone: "green" }, { label: "Needs tuning", value: "9", detail: "3 high volume", tone: "amber" }, { label: "Last 24 hours", value: "327", detail: "detections" }],
    columns: ["Rule", "Severity", "Source", "Updated", "State"], rows: defaultRows, contextTitle: "Detection posture",
    context: [{ label: "MITRE techniques covered", value: "143", tone: "violet" }, { label: "Rules passing tests", value: "96%", tone: "green" }, { label: "Learning mode", value: "7", tone: "amber" }],
  },
  "/cases": {
    eyebrow: "Analyst workspace", action: "Create case",
    metrics: [{ label: "Open cases", value: "34", detail: "8 assigned", tone: "violet" }, { label: "Near SLA", value: "4", detail: "under 30m", tone: "red" }, { label: "Avg resolution", value: "3h 18m", detail: "↓ 22m", tone: "green" }, { label: "Closed today", value: "19", detail: "7 by Argus" }],
    columns: ["Case", "Priority", "Assignee", "Updated", "Status"], rows: defaultRows.map((row, index) => ({ ...row, primary: `CASE-2026-04${18-index} · ${row.primary}`, source: index < 2 ? "Priya N." : "Unassigned", status: index === 0 ? "In progress" : index === 4 ? "Closed" : "Open" })), contextTitle: "Case health",
    context: [{ label: "SLA compliance", value: "94%", tone: "green" }, { label: "Unassigned", value: "11", tone: "amber" }, { label: "Evidence items", value: "1,284", tone: "violet" }],
  },
  "/assets": {
    eyebrow: "Entity intelligence", action: "Add source",
    metrics: [{ label: "Known assets", value: "8,429", detail: "+38 today" }, { label: "High risk", value: "27", detail: "5 critical", tone: "red" }, { label: "Unmanaged", value: "143", detail: "needs review", tone: "amber" }, { label: "Coverage", value: "98.2%", detail: "EDR reporting", tone: "green" }],
    columns: ["Entity", "Risk", "Type", "Last seen", "Exposure"], rows: defaultRows.map((row, index) => ({ ...row, primary: ["WIN-7F3G2K9H8", "jsmith@corp", "SRV-2M9P8Q1", "prod-api-east-1", "185.199.110.153"][index], secondary: ["Windows 11 · Finance", "Privileged identity", "Windows Server 2022", "AWS EC2", "External IP"][index], source: ["Endpoint", "Identity", "Server", "Cloud", "Network"][index], status: ["Exposed", "Elevated", "Managed", "Managed", "Monitored"][index] })), contextTitle: "Inventory health",
    context: [{ label: "Critical assets", value: "214", tone: "red" }, { label: "Identity coverage", value: "99.1%", tone: "green" }, { label: "New relationships", value: "68", tone: "violet" }],
  },
  "/automation": {
    eyebrow: "SOAR and response", action: "New playbook",
    metrics: [{ label: "Active playbooks", value: "28", detail: "12 autonomous", tone: "violet" }, { label: "Runs today", value: "1,042", detail: "98.7% success", tone: "green" }, { label: "Pending approvals", value: "6", detail: "2 high risk", tone: "red" }, { label: "Time saved", value: "46h", detail: "this week" }],
    columns: ["Playbook", "Risk", "Trigger", "Last run", "State"], rows: defaultRows.map((row, index) => ({ ...row, primary: ["Credential compromise containment", "Impossible travel validation", "Malicious IP block", "Phishing mailbox remediation", "Cloud key rotation"][index], secondary: ["5 steps · 2 approvals", "4 steps · autonomous", "3 steps · 1 approval", "7 steps · 1 approval", "4 steps · 2 approvals"][index], source: ["Incident", "Identity alert", "Threat intel", "Email alert", "Cloud alert"][index], status: index === 4 ? "Paused" : "Enabled" })), contextTitle: "Automation policy",
    context: [{ label: "Autonomous actions", value: "41%", tone: "violet" }, { label: "Successful runs", value: "98.7%", tone: "green" }, { label: "Rollback available", value: "18", tone: "neutral" }],
  },
  "/reports": {
    eyebrow: "Security analytics", action: "Generate report",
    metrics: [{ label: "MTTD", value: "7m 42s", detail: "↓ 18%", tone: "green" }, { label: "MTTR", value: "2h 11m", detail: "↓ 24%", tone: "green" }, { label: "False positives", value: "3.8%", detail: "↓ 1.2%", tone: "green" }, { label: "Auto-resolved", value: "41%", detail: "+9%", tone: "violet" }],
    columns: ["Report", "Risk", "Audience", "Generated", "State"], rows: defaultRows.map((row, index) => ({ ...row, primary: ["Weekly SOC performance", "MITRE coverage review", "Executive risk summary", "Detection quality report", "Argus autonomy audit"][index], secondary: ["Operational metrics", "Coverage and gaps", "Board-ready overview", "False positive analysis", "Actions and approvals"][index], source: ["SOC team", "Detection engineering", "Executive", "SOC manager", "Compliance"][index], status: index === 0 ? "Ready" : "Scheduled" })), contextTitle: "Reporting cadence",
    context: [{ label: "Scheduled reports", value: "8", tone: "violet" }, { label: "Delivered this month", value: "31", tone: "green" }, { label: "Next executive report", value: "Jul 25", tone: "neutral" }],
  },
  "/integrations": {
    eyebrow: "Data and response fabric", action: "Add integration",
    metrics: [{ label: "Integrations", value: "8", detail: "4 categories" }, { label: "Connected", value: "6", detail: "healthy", tone: "green" }, { label: "Issues", value: "1", detail: "Okta delayed", tone: "red" }, { label: "Events today", value: "82.4M", detail: "3.8 TB" }],
    columns: ["Integration", "Health", "Category", "Last event", "State"], rows: defaultRows.map((row, index) => ({ ...row, primary: ["Amazon Web Services", "Microsoft Azure", "Google Cloud Platform", "Kubernetes", "Okta Workforce Identity"][index], secondary: ["CloudTrail · GuardDuty · Security Hub", "Defender · Monitor", "Security Command Center", "Audit · Runtime", "System Log · Identity"][index], source: ["Cloud", "Cloud", "Cloud", "Infrastructure", "Identity"][index], status: index === 4 ? "Issue" : "Connected" })), contextTitle: "Ingestion health",
    context: [{ label: "Events per second", value: "9,532", tone: "green" }, { label: "Pipeline latency", value: "1.8s", tone: "green" }, { label: "Schema failures", value: "0.04%", tone: "amber" }],
  },
  "/configurations": {
    eyebrow: "Platform configuration", action: "Add data source",
    metrics: [{ label: "Data sources", value: "14", detail: "12 enabled" }, { label: "Hot retention", value: "30d", detail: "tenant default", tone: "violet" }, { label: "Daily ingest", value: "3.8 TB", detail: "82.4M events" }, { label: "Pipeline health", value: "99.98%", detail: "last 30d", tone: "green" }],
    columns: ["Configuration", "Risk", "Scope", "Updated", "State"], rows: defaultRows.map((row, index) => ({ ...row, primary: ["Default ClickHouse datastore", "OpenSearch federation", "ECS normalization", "Raw archive retention", "PII redaction policy"][index], secondary: ["chdb local · server production", "Tenant-scoped indices", "Vector VRL transform", "Local filesystem", "Agent prompt boundary"][index], source: ["All events", "Federated search", "Ingestion", "Artifacts", "Sensitive data"][index], status: index === 4 ? "Review" : "Enabled" })), contextTitle: "Tenant defaults",
    context: [{ label: "Region", value: "EU West", tone: "neutral" }, { label: "Storage backend", value: "Local", tone: "violet" }, { label: "Isolation policy", value: "Enforced", tone: "green" }],
  },
  "/settings": {
    eyebrow: "Organization and access", action: "Invite user",
    metrics: [{ label: "Members", value: "24", detail: "6 roles" }, { label: "Active sessions", value: "11", detail: "2 service users" }, { label: "API keys", value: "7", detail: "1 expires soon", tone: "amber" }, { label: "Audit coverage", value: "100%", detail: "immutable", tone: "green" }],
    columns: ["Member / policy", "Risk", "Role", "Last active", "State"], rows: defaultRows.map((row, index) => ({ ...row, primary: ["Priya Nair", "Diego Morales", "Sara Chen", "Ravi Patel", "Argus Service Account"][index], secondary: ["priya@aegis.example", "diego@aegis.example", "sara@aegis.example", "ravi@aegis.example", "svc_argus@tenant"][index], source: ["Analyst", "Detection engineer", "SOC manager", "Admin", "Agent"][index], status: "Active" })), contextTitle: "Access posture",
    context: [{ label: "MFA adoption", value: "100%", tone: "green" }, { label: "SSO provider", value: "Okta", tone: "violet" }, { label: "Pending invites", value: "2", tone: "amber" }],
  },
};

function toneForStatus(status: string) {
  if (["Enabled", "Connected", "Active", "Ready", "Managed", "Closed"].includes(status)) return "green" as const;
  if (["Issue", "Paused", "Review", "Near SLA"].includes(status)) return "red" as const;
  if (["Triage", "Monitoring", "Scheduled", "In progress"].includes(status)) return "amber" as const;
  return "violet" as const;
}

export function PageStub({ href }: PageStubProps) {
  const item = allNavItems.find((navItem) => navItem.href === href);
  const config = configs[href] ?? configs["/rules"];
  const Icon = item?.icon ?? SlidersHorizontal;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle
        eyebrow={config.eyebrow}
        title={item?.title ?? "Aegis"}
        description={item?.description ?? "Secure, observable platform operations."}
        actions={<><Button size="sm" variant="secondary"><ArrowUpRight /> Export</Button><Button size="sm" variant="primary"><Plus /> {config.action}</Button></>}
      />
      <MetricStrip metrics={config.metrics} />
      <div className="grid gap-4 p-4 lg:p-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Panel title={`${item?.title ?? "Aegis"} workspace`} eyebrow="Live tenant data" action={<StatusLabel tone="green">Live</StatusLabel>}>
          <Toolbar placeholder={`Search ${item?.title?.toLowerCase() ?? "items"}...`}><Button size="sm" variant="secondary"><SlidersHorizontal /> Columns</Button></Toolbar>
          <div className="soc-scrollbar overflow-x-auto">
            <table className="soc-table min-w-[760px]">
              <thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>{config.rows.map((row) => <tr key={row.primary}><td><div className="flex items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"><Icon className="size-4" /></span><div><p className="text-sm font-medium">{row.primary}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.secondary}</p></div></div></td><td><SeverityBadge severity={row.severity} /></td><td className="text-xs text-muted-foreground">{row.source}</td><td className="font-mono text-xs text-muted-foreground">{row.updated}</td><td><StatusLabel tone={toneForStatus(row.status)}>{row.status}</StatusLabel></td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-muted-foreground">Showing 1–5 of {item?.title === "Assets" ? "8,429" : "118"}</p><div className="flex gap-1"><Button size="sm" variant="secondary">Previous</Button><Button size="sm" variant="secondary">Next</Button></div></div>
        </Panel>
        <div className="space-y-4">
          <Panel title={config.contextTitle} eyebrow="Current posture">
            <div className="divide-y divide-border">{config.context.map((entry) => <div key={entry.label} className="flex items-center justify-between gap-3 px-4 py-3"><span className="text-xs text-muted-foreground">{entry.label}</span><StatusLabel tone={entry.tone ?? "neutral"}>{entry.value}</StatusLabel></div>)}</div>
          </Panel>
          <Panel title="Argus insight" eyebrow="Autonomous analysis">
            <div className="p-4">
              <div className="flex items-center gap-2 text-primary"><span className="flex size-8 items-center justify-center rounded-full bg-primary/10"><Sparkles className="size-4" /></span><span className="text-sm font-semibold">No urgent blockers</span></div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Argus continuously reviews this workspace for risk, drift, and opportunities to reduce analyst workload.</p>
              <div className="mt-4 space-y-2 text-xs"><p className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-low" /> Tenant boundaries enforced</p><p className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-low" /> Actions fully audited</p><p className="flex items-center gap-2"><KeyRound className="size-3.5 text-low" /> Least-privilege access</p></div>
              <div className="mt-4"><DetailLink>Ask Argus about this view</DetailLink></div>
            </div>
          </Panel>
          <div className="soc-panel flex items-center gap-3 p-4"><span className="flex size-9 items-center justify-center rounded-control bg-primary/10 text-primary">{href === "/integrations" ? <Cloud className="size-4" /> : href === "/rules" ? <FileCode2 className="size-4" /> : <Bot className="size-4" />}</span><div><p className="text-xs font-semibold">Aegis control plane</p><p className="text-[10px] text-muted-foreground">Synced 16 seconds ago</p></div><Activity className="ml-auto size-4 text-low" /></div>
        </div>
      </div>
    </div>
  );
}
