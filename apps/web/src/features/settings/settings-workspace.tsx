"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Shield, ShieldCheck, User } from "lucide-react";

import { Panel, StatusLabel, WorkspaceTitle } from "@/components/soc/flagship-ui";
import type { AutonomyPolicy, WhoAmI } from "@/lib/api";

function titleCase(s: string) {
  return s.replace(/[_:-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SettingsWorkspace({
  who,
  policies,
  connectedSources,
}: {
  who: WhoAmI;
  policies: AutonomyPolicy[];
  connectedSources: number;
}) {
  const router = useRouter();
  const [notify, setNotify] = useState(true);
  const [digest, setDigest] = useState(false);
  const denied = policies.filter((p) => p.mode === "deny").length;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle eyebrow="Account" title="Settings" description="Your profile, tenant, access, and workspace preferences." />

      <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-5">
        <Panel title="Profile" eyebrow="Signed in">
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><User className="size-5" /></span>
              <div><p className="font-medium">{who.user_id}</p><p className="text-xs text-muted-foreground capitalize">{who.role}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="soc-inset p-3"><p className="soc-label">Role</p><p className="mt-1 font-medium capitalize">{who.role}</p></div>
              <div className="soc-inset p-3"><p className="soc-label">Permissions</p><p className="mt-1 font-medium">{who.permissions.length}</p></div>
            </div>
          </div>
        </Panel>

        <Panel title="Tenant" eyebrow="Organization">
          <div className="space-y-3 p-4">
            <div className="soc-inset p-3"><p className="soc-label">Tenant ID</p><p className="mt-1 break-all font-mono text-xs">{who.tenant_id}</p></div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="soc-inset p-3"><p className="soc-label">Connected sources</p><p className="mt-1 text-lg font-semibold">{connectedSources}</p></div>
              <div className="soc-inset p-3"><p className="soc-label">Denied actions</p><p className="mt-1 text-lg font-semibold">{denied}</p></div>
            </div>
            <button type="button" onClick={() => router.push("/integrations")} className="text-xs text-primary hover:underline">Manage integrations →</button>
          </div>
        </Panel>

        <Panel title="Access & permissions" eyebrow="RBAC" action={<StatusLabel tone="violet">{who.permissions.length}</StatusLabel>}>
          <div className="flex flex-wrap gap-1.5 p-4">
            {who.permissions.length ? who.permissions.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 rounded-control border border-border bg-surface px-2 py-1 text-[11px]"><KeyRound className="size-3 text-primary" /> {titleCase(p)}</span>
            )) : <p className="text-sm text-muted-foreground">No explicit permissions.</p>}
          </div>
        </Panel>

        <Panel title="Preferences" eyebrow="This workspace">
          <div className="divide-y divide-border">
            {[
              { label: "Incident notifications", desc: "Alert me when a new incident is raised", value: notify, set: setNotify },
              { label: "Daily digest", desc: "Email a summary each morning", value: digest, set: setDigest },
            ].map((row) => (
              <label key={row.label} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                <span><span className="block text-sm font-medium">{row.label}</span><span className="block text-xs text-muted-foreground">{row.desc}</span></span>
                <button type="button" onClick={() => row.set((v) => !v)} className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${row.value ? "bg-primary" : "bg-surface"}`}><span className={`block size-5 rounded-full bg-white transition ${row.value ? "translate-x-5" : ""}`} /></button>
              </label>
            ))}
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-low" /> Preferences are stored per browser in this dev build.</div>
          </div>
        </Panel>

        <Panel title="Security posture" eyebrow="Tenant isolation">
          <div className="space-y-2 p-4 text-xs">
            <p className="flex items-center gap-2"><Shield className="size-3.5 text-low" /> Tenant boundaries enforced on every query (RLS + index prefix).</p>
            <p className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-low" /> Destructive actions gated by human approval.</p>
            <p className="flex items-center gap-2"><KeyRound className="size-3.5 text-low" /> Least-privilege RBAC on all writes.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
