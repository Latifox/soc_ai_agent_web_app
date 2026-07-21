/**
 * Server-side API client for the Aegis FastAPI BFF.
 *
 * Attaches the caller's verified Supabase access token (tenant_id claim) so every
 * request is tenant-scoped end-to-end. Server Components call these directly; client
 * mutations go through /api/backend/[...path] which reuses the same auth.
 */

import { createClient } from "@/lib/supabase/server";

const API_URL = process.env.AEGIS_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  // An onboarded/switched tenant's token (set by /api/tenant/switch) takes precedence.
  try {
    const { cookies } = await import("next/headers");
    const cookieToken = (await cookies()).get("aegis_token")?.value;
    if (cookieToken) return { authorization: `Bearer ${cookieToken}` };
  } catch {
    // Not in a request scope with cookies — fall through.
  }
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return { authorization: `Bearer ${session.access_token}` };
  } catch {
    // Supabase not configured (local dev without `supabase start`).
  }
  // Server-only dev fallback so the console renders real backend data pre-Supabase.
  const devToken = process.env.AEGIS_DEV_TOKEN;
  return devToken ? { authorization: `Bearer ${devToken}` } : {};
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = {
    "content-type": "application/json",
    ...(await authHeaders()),
    ...(init?.headers as Record<string, string> | undefined),
  };
  const resp = await fetch(`${API_URL}/api/v1${path}`, { ...init, headers, cache: "no-store" });
  if (!resp.ok) {
    throw new ApiError(resp.status, `${init?.method ?? "GET"} ${path} → ${resp.status}`);
  }
  return (await resp.json()) as T;
}

/** Swallow API/network failures into a fallback so pages render during partial outages. */
export async function apiTry<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiFetch<T>(path);
  } catch {
    return fallback;
  }
}

// ── Typed resource shapes (mirror apps/api responses) ─────────────────────────

export interface RuleRecord {
  id: string;
  title: string;
  severity: string;
  type: string;
  enabled: boolean;
  version: number;
  tags: string[];
  author?: string;
  yaml: string;
  integration?: string | null;
  applied_at?: string;
  monitor_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MonitorRecord {
  id: string;
  name: string;
  enabled: boolean;
  monitor_type: string;
  schedule?: { period?: { unit: string; interval: number } };
}
export const getMonitors = () =>
  apiTry<{ available: boolean; monitors: MonitorRecord[]; reason?: string }>("/rules/monitors", { available: false, monitors: [] });

export interface IncidentRecord {
  id: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  assignee?: string | null;
  tags: string[];
  detected_at?: string;
  rule_title?: string;
  rule_id?: string;
  source?: string | null;
  entities?: string[];
  created_at?: string;
}

export interface CaseRecord {
  id: string;
  code?: string;
  title: string;
  description?: string;
  status: string;
  assignee?: string | null;
  tags: string[];
  incident_id?: string | null;
  comments?: { author: string; body: string; ts: string }[];
  created_at?: string;
  updated_at?: string;
}

export interface IntegrationRecord {
  id: string;
  provider: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  config: Record<string, unknown>;
}

export interface AssetRecord {
  id: string;
  kind: string;
  name: string;
  criticality: string;
  risk_score: number;
  attributes: Record<string, unknown>;
}

export interface ApprovalRecord {
  id: string;
  run_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  status: string;
  decided_by?: string;
}

export interface AutonomyPolicy {
  id: string;
  action_class: string;
  mode: "auto" | "approve" | "deny";
}

export interface Metrics {
  incidents: {
    total: number;
    open: number;
    by_severity: Record<string, number>;
    by_status: Record<string, number>;
  };
  rules: { total: number; enabled: number; mitre_techniques: string[] };
  cases: { total: number; open: number };
  integrations: { total: number; connected: number; issues: number };
  approvals: { pending: number };
  assets: { total: number; high_risk: number };
}

export const EMPTY_METRICS: Metrics = {
  incidents: { total: 0, open: 0, by_severity: {}, by_status: {} },
  rules: { total: 0, enabled: 0, mitre_techniques: [] },
  cases: { total: 0, open: 0 },
  integrations: { total: 0, connected: 0, issues: 0 },
  approvals: { pending: 0 },
  assets: { total: 0, high_risk: 0 },
};

export interface AgentStatus {
  key: string;
  name: string;
  role: string;
  tier: string;
  state: "running" | "paused" | "idle";
  task: string;
}

export interface AgentsStatusResponse {
  operational: boolean;
  pending_approvals: number;
  agents: AgentStatus[];
}

export interface TelemetryOverview {
  available: boolean;
  reason?: string;
  window_hours: number;
  total_events: number;
  peak_per_hour: number;
  timeline: { bucket: string; label?: string; count: number }[];
  top_sources: { name: string; count: number }[];
  top_categories: { name: string; count: number }[];
  threat_signals?: { key: string; name: string; count: number }[];
}

export const EMPTY_TELEMETRY: TelemetryOverview = {
  available: false,
  window_hours: 24,
  total_events: 0,
  peak_per_hour: 0,
  timeline: [],
  top_sources: [],
  top_categories: [],
  threat_signals: [],
};

export interface ReportSection {
  heading: string;
  body?: string;
  items?: string[];
}
export interface ReportRecord {
  id: string;
  kind: string;
  title: string;
  window_days: number;
  generated_at: string;
  metrics: Record<string, number>;
  sections: ReportSection[];
}
export interface WhoAmI {
  tenant_id: string;
  user_id: string;
  role: string;
  permissions: string[];
}
export const EMPTY_WHOAMI: WhoAmI = { tenant_id: "—", user_id: "—", role: "—", permissions: [] };
export const getWhoami = () => apiTry<WhoAmI>("/whoami", EMPTY_WHOAMI);

export interface TenantRecord {
  id: string;
  name: string;
  status: string;
  opensearch_url?: string | null;
  created_at?: string;
}
export const getTenants = () => apiTry<TenantRecord[]>("/tenants", []);

export interface TenantSettings {
  org_name: string;
  timezone: string;
  contact_email: string;
  preferences: { incident_notifications: boolean; daily_digest: boolean; weekly_report: boolean };
  detection: { default_severity: string; schedule_frequency: string; retention_days: number; auto_close_fp: boolean };
}
export const EMPTY_SETTINGS: TenantSettings = {
  org_name: "Aegis",
  timezone: "UTC",
  contact_email: "",
  preferences: { incident_notifications: true, daily_digest: false, weekly_report: true },
  detection: { default_severity: "medium", schedule_frequency: "15m", retention_days: 90, auto_close_fp: true },
};
export const getSettings = () => apiTry<TenantSettings>("/settings", EMPTY_SETTINGS);

export const getReports = () => apiTry<ReportRecord[]>("/reports", []);
export const getReport = (id: string) => apiFetch<ReportRecord>(`/reports/${id}`);

export const getTelemetry = () => apiTry<TelemetryOverview>("/telemetry/overview", EMPTY_TELEMETRY);
export const getRules = () => apiTry<RuleRecord[]>("/rules", []);
export const getRule = (id: string) => apiFetch<RuleRecord>(`/rules/${id}`);
export const getAgentsStatus = () =>
  apiTry<AgentsStatusResponse>("/agents/status", { operational: false, pending_approvals: 0, agents: [] });
export const getIncidents = () => apiTry<IncidentRecord[]>("/incidents", []);
export const getIncident = (id: string) => apiFetch<IncidentRecord>(`/incidents/${id}`);
export const getCases = () => apiTry<CaseRecord[]>("/cases", []);
export const getCase = (id: string) => apiFetch<CaseRecord>(`/cases/${id}`);
export const getIntegrations = () => apiTry<IntegrationRecord[]>("/integrations", []);
export const getAssets = () => apiTry<AssetRecord[]>("/assets", []);
export const getApprovals = () => apiTry<ApprovalRecord[]>("/approvals", []);
export const getAutonomyPolicies = () => apiTry<AutonomyPolicy[]>("/autonomy-policies", []);
export const getMetrics = () => apiTry<Metrics>("/metrics", EMPTY_METRICS);
