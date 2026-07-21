"use client";

import { useState } from "react";
import { Building2, Check, Loader2, LogOut, Plug, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, StatusLabel } from "@/components/soc/flagship-ui";
import { cn } from "@/lib/utils";
import { OnboardingWizard } from "@/features/workspaces/onboarding-wizard";
import type { TenantRecord } from "@/lib/api";

export function TenantsBar({ tenants, currentTenantId }: { tenants: TenantRecord[]; currentTenantId: string }) {
  const [wizard, setWizard] = useState(false);
  const [busy, setBusy] = useState("");

  async function switchTo(id: string) {
    // Switching requires a token for that tenant; onboarding returns one. For pre-existing
    // tenants we reset to the default workspace (the current session's token).
    setBusy(id);
    if (id === currentTenantId) { setBusy(""); return; }
    await fetch("/api/tenant/switch", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="p-4 pb-0 lg:p-5 lg:pb-0">
      <Panel
        title="Workspaces"
        eyebrow="Multi-tenant"
        action={<Button size="sm" variant="primary" onClick={() => setWizard(true)}><Rocket /> Onboard workspace</Button>}
      >
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">No workspaces yet — onboard one to connect an external OpenSearch source.</p>
          ) : null}
          {tenants.map((t) => {
            const active = t.id === currentTenantId;
            return (
              <div key={t.id} className={cn("flex items-center gap-3 rounded-control border p-3", active ? "border-primary/50 bg-primary/[0.05]" : "border-border")}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"><Building2 className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{t.opensearch_url ? <span className="inline-flex items-center gap-1"><Plug className="size-2.5" /> {t.opensearch_url.replace(/^https?:\/\//, "")}</span> : t.id.slice(0, 8)}</p>
                </div>
                {active ? (
                  <StatusLabel tone="green"><Check className="mr-1 inline size-3" /> Active</StatusLabel>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => switchTo(t.id)} disabled={busy === t.id}>{busy === t.id ? <Loader2 className="animate-spin" /> : "Open"}</Button>
                )}
              </div>
            );
          })}
        </div>
        {tenants.some((t) => t.id !== currentTenantId) ? (
          <div className="flex items-center justify-end border-t border-border px-4 py-2.5">
            <button type="button" onClick={async () => { await fetch("/api/tenant/switch", { method: "DELETE" }); window.location.reload(); }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><LogOut className="size-3.5" /> Return to default workspace</button>
          </div>
        ) : null}
      </Panel>
      {wizard ? <OnboardingWizard onClose={() => setWizard(false)} /> : null}
    </div>
  );
}
