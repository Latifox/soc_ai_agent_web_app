"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Loader2, Plug, Rocket, Search, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Health = { ok?: boolean; detail?: string; latency_ms?: number; error?: string };

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.status === 204 ? null : resp.json();
}

const STEPS = ["Workspace", "Source", "Provision"] as const;

export function OnboardingWizard({ onClose, firstRun = false }: { onClose: () => void; firstRun?: boolean }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [os, setOs] = useState({ url: "", user: "admin", password: "" });
  const [testHealth, setTestHealth] = useState<Health | null>(null);
  const [testing, setTesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ tenant: { id: string; name: string }; source_health: Health; token: string } | null>(null);
  const [error, setError] = useState("");

  async function test() {
    setTesting(true);
    setTestHealth(null);
    try {
      const h = (await backend("tenants/test-source", { method: "POST", body: JSON.stringify({ opensearch: os }) })) as Health;
      setTestHealth(h);
    } catch {
      setTestHealth({ ok: false, error: "Request failed — are you an admin?" });
    } finally {
      setTesting(false);
    }
  }

  async function create() {
    setCreating(true);
    setError("");
    try {
      // First-run users (fresh Supabase signup, no tenant yet) bootstrap; existing admins add.
      const endpoint = firstRun ? "tenants/bootstrap" : "tenants";
      const r = (await backend(endpoint, { method: "POST", body: JSON.stringify({ name, tenant_id: tenantId.trim() || undefined, opensearch: os }) })) as typeof result;
      setResult(r);
      // Stash the token so the workspace drawer can switch into this tenant later.
      if (r?.token) try { localStorage.setItem(`aegis_token_${r.tenant.id}`, r.token); } catch {}
      // First-run: immediately activate the new workspace so the console has a tenant context.
      if (firstRun && r?.token) {
        await fetch("/api/tenant/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: r.token }) });
      }
      setStep(2);
    } catch {
      setError(firstRun ? "Onboarding failed — check the OpenSearch details and try again." : "Onboarding failed — needs admin (autonomy:write).");
    } finally {
      setCreating(false);
    }
  }

  async function switchTo() {
    if (!result) return;
    await fetch("/api/tenant/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: result.token }) });
    window.location.href = "/dashboard";
  }

  const canNext = step === 0 ? name.trim().length > 1 : step === 1 ? os.url.trim().length > 0 && testHealth?.ok : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl overflow-hidden rounded-card border border-border bg-popover shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Rocket className="size-5 text-primary" /> Onboard a workspace</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X className="size-5 text-muted-foreground" /></button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-semibold", i <= step ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground")}>
                {i < step || result ? <CheckCircle2 className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("text-xs", i === step ? "font-medium text-foreground" : "text-muted-foreground")}>{s}</span>
              {i < STEPS.length - 1 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
            </div>
          ))}
        </div>

        <div className="p-5">
          {step === 0 ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-control bg-primary/10 text-primary"><Building2 className="size-4" /></span>
                <p className="text-sm text-muted-foreground">Name the new tenant. It becomes an isolated workspace — its own incidents, rules, cases, and data source.</p>
              </div>
              <label className="block space-y-1 text-sm"><span className="soc-label">Workspace name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp SOC" className="h-10 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" autoFocus /></label>
              <label className="block space-y-1 text-sm"><span className="soc-label">Tenant ID (optional)</span>
                <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="match your Logstash LOGSTASH_TENANT_ID (e.g. sekera-vps-01)" className="h-9 w-full rounded-control border border-border bg-surface px-3 font-mono text-xs outline-none focus:border-primary" />
                <span className="text-[11px] text-muted-foreground">Set this to your log pipeline&apos;s tenant id so the crew queries <code>t-&lt;id&gt;-*</code>. Leave blank to auto-generate.</span></label>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-control bg-primary/10 text-primary"><Search className="size-4" /></span>
                <p className="text-sm text-muted-foreground">Connect this workspace to its OpenSearch cluster (logs + detection). Test before provisioning.</p>
              </div>
              <label className="block space-y-1 text-sm"><span className="soc-label">OpenSearch URL</span>
                <input value={os.url} onChange={(e) => { setOs((o) => ({ ...o, url: e.target.value })); setTestHealth(null); }} placeholder="https://cluster.example.com:9200" className="h-9 w-full rounded-control border border-border bg-surface px-3 font-mono text-xs outline-none focus:border-primary" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm"><span className="soc-label">User</span>
                  <input value={os.user} onChange={(e) => setOs((o) => ({ ...o, user: e.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" /></label>
                <label className="space-y-1 text-sm"><span className="soc-label">Password</span>
                  <input type="password" value={os.password} onChange={(e) => setOs((o) => ({ ...o, password: e.target.value }))} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" /></label>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="secondary" onClick={test} disabled={testing || !os.url.trim()}>{testing ? <Loader2 className="animate-spin" /> : <Plug />} Test connection</Button>
                {testHealth ? (
                  testHealth.ok ? (
                    <span className="flex items-center gap-1.5 text-xs text-low"><CheckCircle2 className="size-4" /> {testHealth.detail} · {testHealth.latency_ms} ms</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-high"><XCircle className="size-4" /> {testHealth.error ?? testHealth.detail}</span>
                  )
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 && result ? (
            <div className="space-y-4 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-low/15 text-low"><CheckCircle2 className="size-6" /></span>
              <div>
                <p className="text-base font-semibold">{result.tenant.name} is live</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">tenant {result.tenant.id.slice(0, 8)} · source {result.source_health.ok ? "connected" : "error"}</p>
              </div>
              <p className="text-sm text-muted-foreground">The workspace, its OpenSearch source, and agent access are provisioned in Supabase. Switch in to start ingesting.</p>
              <div className="flex justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={onClose}>Stay here</Button>
                <Button size="sm" variant="primary" onClick={switchTo}><Rocket /> Switch to {result.tenant.name}</Button>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-xs text-high">{error}</p> : null}
        </div>

        {step < 2 ? (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <Button size="sm" variant="ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}><ArrowLeft /> {step === 0 ? "Cancel" : "Back"}</Button>
            {step === 1 ? (
              <Button size="sm" variant="primary" onClick={create} disabled={!canNext || creating}>{creating ? <Loader2 className="animate-spin" /> : <Rocket />} Provision workspace</Button>
            ) : (
              <Button size="sm" variant="primary" onClick={() => setStep(step + 1)} disabled={!canNext}>Next <ArrowRight /></Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
