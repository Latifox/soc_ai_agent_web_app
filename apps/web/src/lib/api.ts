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
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { authorization: `Bearer ${session.access_token}` } : {};
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
  created_at?: string;
  updated_at?: string;
}

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
  comments?: { author: string; body: string; ts: string }[];
  created_at?: string;
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

export const getRules = () => apiTry<RuleRecord[]>("/rules", []);
export const getIncidents = () => apiTry<IncidentRecord[]>("/incidents", []);
export const getCases = () => apiTry<CaseRecord[]>("/cases", []);
export const getIntegrations = () => apiTry<IntegrationRecord[]>("/integrations", []);
export const getAssets = () => apiTry<AssetRecord[]>("/assets", []);
export const getApprovals = () => apiTry<ApprovalRecord[]>("/approvals", []);
export const getAutonomyPolicies = () => apiTry<AutonomyPolicy[]>("/autonomy-policies", []);
export const getMetrics = () => apiTry<Metrics>("/metrics", EMPTY_METRICS);
