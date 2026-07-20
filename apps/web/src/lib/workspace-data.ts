import type { Severity } from "@/components/soc/flagship-ui";

export type WorkspaceKey =
  | "rules"
  | "cases"
  | "assets"
  | "automation"
  | "reports"
  | "integrations"
  | "configurations"
  | "settings";

export type WorkspaceTone = "red" | "green" | "violet" | "amber";

export interface WorkspaceMetric {
  label: string;
  value: string;
  detail: string;
  tone?: WorkspaceTone;
}

export interface WorkspaceRecord {
  id: string;
  primary: string;
  secondary: string;
  severity: Severity;
  source: string;
  updated: string;
  status: string;
  owner: string;
  description: string;
}

export interface WorkspaceContextItem {
  label: string;
  value: string;
  tone?: "green" | "amber" | "red" | "violet" | "neutral";
}

export interface WorkspaceConfig {
  key: WorkspaceKey;
  href: string;
  title: string;
  eyebrow: string;
  description: string;
  action: string;
  idPrefix: string;
  columns: [string, string, string, string, string];
  metrics: WorkspaceMetric[];
  records: WorkspaceRecord[];
  contextTitle: string;
  context: WorkspaceContextItem[];
  insight: string;
}

const incidentRows: WorkspaceRecord[] = [
  {
    id: "DET-1003",
    primary: "Credential Access via LSASS",
    secondary: "T1003.001 - Windows",
    severity: "critical",
    source: "Endpoint",
    updated: "2m ago",
    status: "Investigating",
    owner: "Priya N.",
    description: "Correlates suspicious login, encoded PowerShell, and LSASS memory access.",
  },
  {
    id: "DET-1078",
    primary: "Impossible Travel",
    secondary: "T1078 - Identity",
    severity: "medium",
    source: "Okta",
    updated: "18m ago",
    status: "Open",
    owner: "Unassigned",
    description: "Flags geographically impossible access patterns with MFA context.",
  },
  {
    id: "DET-1621",
    primary: "MFA Fatigue / Push Bombing",
    secondary: "T1621 - Identity",
    severity: "high",
    source: "Azure AD",
    updated: "32m ago",
    status: "Triage",
    owner: "Diego M.",
    description: "Detects repeated denied MFA prompts followed by a successful sign-in.",
  },
  {
    id: "DET-1059",
    primary: "Suspicious PowerShell",
    secondary: "T1059.001 - Execution",
    severity: "high",
    source: "Microsoft Defender",
    updated: "1h ago",
    status: "Enabled",
    owner: "Sara C.",
    description: "Scores encoded commands, download cradles, and LOLBin chaining.",
  },
  {
    id: "DET-1071",
    primary: "DNS Tunneling Suspicion",
    secondary: "T1071.004 - C2",
    severity: "medium",
    source: "Cloudflare",
    updated: "2h ago",
    status: "Monitoring",
    owner: "Argus",
    description: "Looks for high entropy subdomains and periodic beacon-like requests.",
  },
];

export const workspaceConfigs: Record<WorkspaceKey, WorkspaceConfig> = {
  rules: {
    key: "rules",
    href: "/rules",
    title: "Rules",
    eyebrow: "Detection engineering",
    description: "Create, tune, and promote detection logic with coverage visibility.",
    action: "New rule",
    idPrefix: "RULE",
    metrics: [
      { label: "Active rules", value: "118", detail: "6 types", tone: "violet" },
      { label: "Coverage", value: "74%", detail: "+6% this month", tone: "green" },
      { label: "Needs tuning", value: "9", detail: "3 high volume", tone: "amber" },
      { label: "Last 24 hours", value: "327", detail: "detections" },
    ],
    columns: ["Rule", "Severity", "Source", "Updated", "State"],
    records: incidentRows,
    contextTitle: "Detection posture",
    context: [
      { label: "MITRE techniques covered", value: "143", tone: "violet" },
      { label: "Rules passing tests", value: "96%", tone: "green" },
      { label: "Learning mode", value: "7", tone: "amber" },
    ],
    insight: "Two high-volume rules can move to learning mode without reducing critical coverage.",
  },
  cases: {
    key: "cases",
    href: "/cases",
    title: "Cases",
    eyebrow: "Analyst workspace",
    description: "Assign, track, and close analyst investigations with evidence history.",
    action: "Create case",
    idPrefix: "CASE",
    metrics: [
      { label: "Open cases", value: "34", detail: "8 assigned", tone: "violet" },
      { label: "Near SLA", value: "4", detail: "under 30m", tone: "red" },
      { label: "Avg resolution", value: "3h 18m", detail: "down 22m", tone: "green" },
      { label: "Closed today", value: "19", detail: "7 by Argus" },
    ],
    columns: ["Case", "Priority", "Assignee", "Updated", "Status"],
    records: incidentRows.map((row, index) => ({
      ...row,
      id: `CASE-2026-04${18 - index}`,
      primary: `CASE-2026-04${18 - index} - ${row.primary}`,
      source: index < 2 ? "Priya N." : "Unassigned",
      status: index === 0 ? "In progress" : index === 4 ? "Closed" : "Open",
      owner: index < 2 ? "Priya N." : "Queue",
    })),
    contextTitle: "Case health",
    context: [
      { label: "SLA compliance", value: "94%", tone: "green" },
      { label: "Unassigned", value: "11", tone: "amber" },
      { label: "Evidence items", value: "1,284", tone: "violet" },
    ],
    insight: "Assigning the four unowned high-priority cases would remove the current SLA risk.",
  },
  assets: {
    key: "assets",
    href: "/assets",
    title: "Assets",
    eyebrow: "Entity intelligence",
    description: "Track endpoints, users, services, and exposure tied to detections.",
    action: "Add asset",
    idPrefix: "ASSET",
    metrics: [
      { label: "Known assets", value: "8,429", detail: "+38 today" },
      { label: "High risk", value: "27", detail: "5 critical", tone: "red" },
      { label: "Unmanaged", value: "143", detail: "needs review", tone: "amber" },
      { label: "Coverage", value: "98.2%", detail: "EDR reporting", tone: "green" },
    ],
    columns: ["Entity", "Risk", "Type", "Last seen", "Exposure"],
    records: incidentRows.map((row, index) => ({
      ...row,
      id: ["WIN-7F3G2K9H8", "USR-JSMITH", "SRV-2M9P8Q1", "AWS-PROD-API", "IP-185-199-110-153"][index],
      primary: ["WIN-7F3G2K9H8", "jsmith@corp", "SRV-2M9P8Q1", "prod-api-east-1", "185.199.110.153"][index],
      secondary: ["Windows 11 - Finance", "Privileged identity", "Windows Server 2022", "AWS EC2", "External IP"][index],
      source: ["Endpoint", "Identity", "Server", "Cloud", "Network"][index],
      status: ["Exposed", "Elevated", "Managed", "Managed", "Monitored"][index],
      owner: ["Finance", "Identity", "Infrastructure", "Cloud", "Network"][index],
    })),
    contextTitle: "Inventory health",
    context: [
      { label: "Critical assets", value: "214", tone: "red" },
      { label: "Identity coverage", value: "99.1%", tone: "green" },
      { label: "New relationships", value: "68", tone: "violet" },
    ],
    insight: "Most new risk is identity-linked; review privileged accounts before endpoint drift.",
  },
  automation: {
    key: "automation",
    href: "/automation",
    title: "Automation",
    eyebrow: "SOAR and response",
    description: "Operate response playbooks with approvals, rollback, and audit history.",
    action: "New playbook",
    idPrefix: "PLAY",
    metrics: [
      { label: "Active playbooks", value: "28", detail: "12 autonomous", tone: "violet" },
      { label: "Runs today", value: "1,042", detail: "98.7% success", tone: "green" },
      { label: "Pending approvals", value: "6", detail: "2 high risk", tone: "red" },
      { label: "Time saved", value: "46h", detail: "this week" },
    ],
    columns: ["Playbook", "Risk", "Trigger", "Last run", "State"],
    records: incidentRows.map((row, index) => ({
      ...row,
      id: `PLAY-${index + 1}`,
      primary: ["Credential compromise containment", "Impossible travel validation", "Malicious IP block", "Phishing mailbox remediation", "Cloud key rotation"][index],
      secondary: ["5 steps - 2 approvals", "4 steps - autonomous", "3 steps - 1 approval", "7 steps - 1 approval", "4 steps - 2 approvals"][index],
      source: ["Incident", "Identity alert", "Threat intel", "Email alert", "Cloud alert"][index],
      status: index === 4 ? "Paused" : "Enabled",
      owner: index === 4 ? "Cloud Sec" : "Argus",
    })),
    contextTitle: "Automation policy",
    context: [
      { label: "Autonomous actions", value: "41%", tone: "violet" },
      { label: "Successful runs", value: "98.7%", tone: "green" },
      { label: "Rollback available", value: "18", tone: "neutral" },
    ],
    insight: "Response playbooks are healthy; only cloud key rotation needs an approval owner.",
  },
  reports: {
    key: "reports",
    href: "/reports",
    title: "Reports",
    eyebrow: "Security analytics",
    description: "Generate operational, executive, and compliance-ready SOC reports.",
    action: "Generate report",
    idPrefix: "REPORT",
    metrics: [
      { label: "MTTD", value: "7m 42s", detail: "down 18%", tone: "green" },
      { label: "MTTR", value: "2h 11m", detail: "down 24%", tone: "green" },
      { label: "False positives", value: "3.8%", detail: "down 1.2%", tone: "green" },
      { label: "Auto-resolved", value: "41%", detail: "+9%", tone: "violet" },
    ],
    columns: ["Report", "Risk", "Audience", "Generated", "State"],
    records: incidentRows.map((row, index) => ({
      ...row,
      id: `RPT-${index + 1}`,
      primary: ["Weekly SOC performance", "MITRE coverage review", "Executive risk summary", "Detection quality report", "Argus autonomy audit"][index],
      secondary: ["Operational metrics", "Coverage and gaps", "Board-ready overview", "False positive analysis", "Actions and approvals"][index],
      source: ["SOC team", "Detection engineering", "Executive", "SOC manager", "Compliance"][index],
      status: index === 0 ? "Ready" : "Scheduled",
      owner: ["SOC", "Detection", "CISO", "Manager", "Compliance"][index],
    })),
    contextTitle: "Reporting cadence",
    context: [
      { label: "Scheduled reports", value: "8", tone: "violet" },
      { label: "Delivered this month", value: "31", tone: "green" },
      { label: "Next executive report", value: "Jul 25", tone: "neutral" },
    ],
    insight: "The executive report is ready to regenerate after the latest MTTR improvements.",
  },
  integrations: {
    key: "integrations",
    href: "/integrations",
    title: "Integrations",
    eyebrow: "Data and response fabric",
    description: "Connect log sources, enrichers, ticketing, and response tools.",
    action: "Add integration",
    idPrefix: "INT",
    metrics: [
      { label: "Integrations", value: "8", detail: "4 categories" },
      { label: "Connected", value: "6", detail: "healthy", tone: "green" },
      { label: "Issues", value: "1", detail: "Okta delayed", tone: "red" },
      { label: "Events today", value: "82.4M", detail: "3.8 TB" },
    ],
    columns: ["Integration", "Health", "Category", "Last event", "State"],
    records: incidentRows.map((row, index) => ({
      ...row,
      id: `INT-${index + 1}`,
      primary: ["Amazon Web Services", "Microsoft Azure", "Google Cloud Platform", "Kubernetes", "Okta Workforce Identity"][index],
      secondary: ["CloudTrail - GuardDuty - Security Hub", "Defender - Monitor", "Security Command Center", "Audit - Runtime", "System Log - Identity"][index],
      source: ["Cloud", "Cloud", "Cloud", "Infrastructure", "Identity"][index],
      status: index === 4 ? "Issue" : "Connected",
      owner: ["Cloud Sec", "Cloud Sec", "Cloud Sec", "Platform", "Identity"][index],
    })),
    contextTitle: "Ingestion health",
    context: [
      { label: "Events per second", value: "9,532", tone: "green" },
      { label: "Pipeline latency", value: "1.8s", tone: "green" },
      { label: "Schema failures", value: "0.04%", tone: "amber" },
    ],
    insight: "Okta is delayed but not dropping events; identity detections may lag by about 11 minutes.",
  },
  configurations: {
    key: "configurations",
    href: "/configurations",
    title: "Configurations",
    eyebrow: "Platform configuration",
    description: "Control tenant defaults, retention, normalization, and policy boundaries.",
    action: "Add data source",
    idPrefix: "CFG",
    metrics: [
      { label: "Data sources", value: "14", detail: "12 enabled" },
      { label: "Hot retention", value: "30d", detail: "tenant default", tone: "violet" },
      { label: "Daily ingest", value: "3.8 TB", detail: "82.4M events" },
      { label: "Pipeline health", value: "99.98%", detail: "last 30d", tone: "green" },
    ],
    columns: ["Configuration", "Risk", "Scope", "Updated", "State"],
    records: incidentRows.map((row, index) => ({
      ...row,
      id: `CFG-${index + 1}`,
      primary: ["Default ClickHouse datastore", "OpenSearch federation", "ECS normalization", "Raw archive retention", "PII redaction policy"][index],
      secondary: ["chdb local - server production", "Tenant-scoped indices", "Vector VRL transform", "Local filesystem", "Agent prompt boundary"][index],
      source: ["All events", "Federated search", "Ingestion", "Artifacts", "Sensitive data"][index],
      status: index === 4 ? "Review" : "Enabled",
      owner: ["Platform", "Search", "Ingestion", "Storage", "Security"][index],
    })),
    contextTitle: "Tenant defaults",
    context: [
      { label: "Region", value: "EU West", tone: "neutral" },
      { label: "Storage backend", value: "Local", tone: "violet" },
      { label: "Isolation policy", value: "Enforced", tone: "green" },
    ],
    insight: "Tenant isolation is enforced; PII redaction is the only setting awaiting review.",
  },
  settings: {
    key: "settings",
    href: "/settings",
    title: "Settings",
    eyebrow: "Organization and access",
    description: "Manage users, roles, service accounts, SSO, and audit controls.",
    action: "Invite user",
    idPrefix: "USER",
    metrics: [
      { label: "Members", value: "24", detail: "6 roles" },
      { label: "Active sessions", value: "11", detail: "2 service users" },
      { label: "API keys", value: "7", detail: "1 expires soon", tone: "amber" },
      { label: "Audit coverage", value: "100%", detail: "immutable", tone: "green" },
    ],
    columns: ["Member / policy", "Risk", "Role", "Last active", "State"],
    records: incidentRows.map((row, index) => ({
      ...row,
      id: `USR-${index + 1}`,
      primary: ["Priya Nair", "Diego Morales", "Sara Chen", "Ravi Patel", "Argus Service Account"][index],
      secondary: ["priya@aegis.example", "diego@aegis.example", "sara@aegis.example", "ravi@aegis.example", "svc_argus@tenant"][index],
      source: ["Analyst", "Detection engineer", "SOC manager", "Admin", "Agent"][index],
      status: "Active",
      owner: ["Tier 2", "Engineering", "Manager", "Admin", "Service"][index],
    })),
    contextTitle: "Access posture",
    context: [
      { label: "MFA adoption", value: "100%", tone: "green" },
      { label: "SSO provider", value: "Okta", tone: "violet" },
      { label: "Pending invites", value: "2", tone: "amber" },
    ],
    insight: "Access posture is healthy; rotate the service API key before the next audit window.",
  },
};
