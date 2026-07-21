"use client";

import { useEffect, useState } from "react";
import { Building2, Check, ChevronRight, Loader2, LogOut, Plug, Rocket, Search, Settings2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusLabel } from "@/components/soc/flagship-ui";
import { cn } from "@/lib/utils";
import { OnboardingWizard } from "@/features/workspaces/onboarding-wizard";
import type { IntegrationRecord, TenantRecord, WhoAmI } from "@/lib/api";

type Health = { ok?: boolean; detail?: string; latency_ms?: number; error?: string };

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.status === 204 ? null : resp.json();
}

export function TenantDrawer({ onClose }: { onClose: () => void }) {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [who, setWho] = useState<WhoAmI | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [wizard, setWizard] = useState(false);
  const [configure, setConfigure] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, w] = await Promise.all([backend("tenants"), backend("whoami")]);
        setTenants(t as TenantRecord[]);
        setWho(w as WhoAmI);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function switchTo(t: TenantRecord) {
    if (t.id === who?.tenant_id) return;
    setBusy(t.id);
    const token = typeof window !== "undefined" ? localStorage.getItem(`aegis_token_${t.id}`) : null;
    if (token) {
      await fetch("/api/tenant/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    } else {
      // No stored token for this workspace — return to the default session tenant.
      await fetch("/api/tenant/switch", { method: "DELETE" });
    }
    window.location.href = "/dashboard";
  }

  async function toDefault() {
    await fetch("/api/tenant/switch", { method: "DELETE" });
    window.location.href = "/dashboard";
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-y-0 left-0 z-50 flex w-full max-w-sm flex-col border-r border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Building2 className="size-4 text-primary" /> Workspaces</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X className="size-5 text-muted-foreground" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <Button size="sm" variant="primary" className="w-full justify-center" onClick={() => setWizard(true)}>
            <Rocket /> Onboard a workspace
          </Button>

          <div>
            <p className="soc-label mb-2">Switch workspace</p>
            {loading ? (
              <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</p>
            ) : (
              <div className="space-y-2">
                {tenants.map((t) => {
                  const active = t.id === who?.tenant_id;
                  const hasToken = typeof window !== "undefined" && !!localStorage.getItem(`aegis_token_${t.id}`);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => switchTo(t)}
                      disabled={busy === t.id || active}
                      className={cn("flex w-full items-center gap-3 rounded-control border p-3 text-left transition", active ? "border-primary/50 bg-primary/[0.05]" : "border-border hover:border-primary/40")}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"><Building2 className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {t.opensearch_url ? <span className="inline-flex items-center gap-1"><Plug className="size-2.5" /> {t.opensearch_url.replace(/^https?:\/\//, "").replace(/:[^@/]+@/, "@")}</span> : t.id.slice(0, 8)}
                        </p>
                      </div>
                      {active ? (
                        <StatusLabel tone="green"><Check className="mr-1 inline size-3" /> Active</StatusLabel>
                      ) : busy === t.id ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">{hasToken ? "Open" : "Default"} <ChevronRight className="size-3" /></span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button type="button" onClick={() => setConfigure((v) => !v)} className="flex w-full items-center justify-between rounded-control border border-border p-3 text-sm hover:border-primary/40">
            <span className="flex items-center gap-2"><Settings2 className="size-4 text-primary" /> Configure current source</span>
            <ChevronRight className={cn("size-4 transition", configure ? "rotate-90" : "")} />
          </button>
          {configure ? <ConfigureSource /> : null}
        </div>

        <div className="border-t border-border p-3">
          <button type="button" onClick={toDefault} className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><LogOut className="size-3.5" /> Return to default workspace</button>
        </div>
      </div>

      {wizard ? <OnboardingWizard onClose={() => setWizard(false)} /> : null}
    </>
  );
}

function ConfigureSource() {
  const [integration, setIntegration] = useState<(IntegrationRecord & { health?: Health }) | null>(null);
  const [os, setOs] = useState({ url: "", user: "admin", password: "" });
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState<"" | "test" | "save">("");

  useEffect(() => {
    (async () => {
      try {
        const ints = (await backend("integrations")) as (IntegrationRecord & { health?: Health })[];
        const osInt = ints.find((i) => i.provider === "opensearch") ?? null;
        setIntegration(osInt);
        if (osInt) {
          const c = (osInt.config ?? {}) as Record<string, string>;
          setOs({ url: c.url ?? "", user: c.user ?? "admin", password: c.password ?? "" });
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function save(test: boolean) {
    if (!integration) return;
    setBusy(test ? "test" : "save");
    try {
      await backend(`integrations/${integration.id}`, { method: "PATCH", body: JSON.stringify({ config: { ...os, agent_access: true } }) });
      if (test) {
        const updated = (await backend(`integrations/${integration.id}/test`, { method: "POST" })) as IntegrationRecord & { health?: Health };
        setHealth(updated.health ?? null);
      } else {
        setHealth({ ok: true, detail: "Saved" });
      }
    } catch {
      setHealth({ ok: false, error: "Failed" });
    } finally {
      setBusy("");
    }
  }

  if (!integration) return <p className="px-1 text-xs text-muted-foreground">No OpenSearch source on this workspace yet.</p>;

  return (
    <div className="space-y-2 rounded-control border border-border bg-surface-subtle/30 p-3">
      <label className="block space-y-1 text-xs"><span className="soc-label flex items-center gap-1"><Search className="size-3" /> OpenSearch URL</span>
        <input value={os.url} onChange={(e) => setOs((o) => ({ ...o, url: e.target.value }))} className="h-8 w-full rounded-control border border-border bg-surface px-2 font-mono text-[11px] outline-none focus:border-primary" /></label>
      <div className="grid grid-cols-2 gap-2">
        <input value={os.user} onChange={(e) => setOs((o) => ({ ...o, user: e.target.value }))} placeholder="user" className="h-8 rounded-control border border-border bg-surface px-2 text-xs outline-none focus:border-primary" />
        <input type="password" value={os.password} onChange={(e) => setOs((o) => ({ ...o, password: e.target.value }))} placeholder="password" className="h-8 rounded-control border border-border bg-surface px-2 text-xs outline-none focus:border-primary" />
      </div>
      {health ? <p className={cn("text-[11px]", health.ok ? "text-low" : "text-high")}>{health.ok ? `✓ ${health.detail ?? "OK"}${health.latency_ms ? ` · ${health.latency_ms} ms` : ""}` : `✗ ${health.error ?? health.detail}`}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onClick={() => save(false)} disabled={busy !== ""}>{busy === "save" ? <Loader2 className="animate-spin" /> : null} Save</Button>
        <Button size="sm" variant="primary" onClick={() => save(true)} disabled={busy !== ""}>{busy === "test" ? <Loader2 className="animate-spin" /> : <Plug />} Test</Button>
      </div>
    </div>
  );
}
