"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Save, Shield, ShieldCheck, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, StatusLabel, WorkspaceTitle } from "@/components/soc/flagship-ui";
import type { AutonomyPolicy, TenantSettings, WhoAmI } from "@/lib/api";

const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Singapore"];

function titleCase(s: string) {
  return s.replace(/[_:-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.status === 204 ? null : resp.json();
}

export function SettingsWorkspace({
  who,
  policies,
  connectedSources,
  settings: initial,
}: {
  who: WhoAmI;
  policies: AutonomyPolicy[];
  connectedSources: number;
  settings: TenantSettings;
}) {
  const router = useRouter();
  const [orgName, setOrgName] = useState(initial.org_name);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [email, setEmail] = useState(initial.contact_email);
  const [prefs, setPrefs] = useState(initial.preferences);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState<"" | "org" | "prefs" | "tenant">("");
  const [notice, setNotice] = useState("");
  const [tenantName, setTenantName] = useState(who.tenant_name ?? "");
  const [savedTenantName, setSavedTenantName] = useState(who.tenant_name ?? "");

  const denied = policies.filter((p) => p.mode === "deny").length;
  const orgDirty = orgName !== saved.org_name || timezone !== saved.timezone || email !== saved.contact_email;
  const tenantDirty = tenantName.trim() !== "" && tenantName.trim() !== savedTenantName;

  async function saveTenant() {
    setBusy("tenant");
    setNotice("");
    try {
      const updated = (await backend(`tenants/${who.tenant_id}`, { method: "PATCH", body: JSON.stringify({ name: tenantName.trim() }) })) as { name?: string };
      const next = updated.name ?? tenantName.trim();
      setTenantName(next);
      setSavedTenantName(next);
      setNotice("Tenant name saved.");
      router.refresh();
    } catch {
      setNotice("Rename failed — needs admin (autonomy:write).");
    } finally {
      setBusy("");
    }
  }

  async function save(patch: Record<string, unknown>, kind: "org" | "prefs") {
    setBusy(kind);
    setNotice("");
    try {
      const updated = (await backend("settings", { method: "PUT", body: JSON.stringify(patch) })) as TenantSettings;
      setSaved(updated);
      setOrgName(updated.org_name);
      setTimezone(updated.timezone);
      setEmail(updated.contact_email);
      setPrefs(updated.preferences);
      setNotice("Saved.");
    } catch {
      setNotice("Save failed — needs admin (autonomy:write).");
    } finally {
      setBusy("");
    }
  }

  function togglePref(key: keyof TenantSettings["preferences"]) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    save({ preferences: next }, "prefs");
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <WorkspaceTitle eyebrow="Account" title="Settings" description="Your profile, tenant, access, and workspace preferences." />
      {notice ? <div className="mx-4 mt-4 rounded-control border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary lg:mx-5">{notice}</div> : null}

      <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-5">
        <Panel title="Organization" eyebrow="Editable" action={<Button size="sm" variant="primary" onClick={() => save({ org_name: orgName, timezone, contact_email: email }, "org")} disabled={busy !== "" || !orgDirty}>{busy === "org" ? <Loader2 className="animate-spin" /> : <Save />} Save</Button>}>
          <div className="space-y-3 p-4">
            <label className="block space-y-1 text-sm"><span className="soc-label">Organization name</span>
              <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" /></label>
            <label className="block space-y-1 text-sm"><span className="soc-label">Contact email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="soc@org.com" className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" /></label>
            <label className="block space-y-1 text-sm"><span className="soc-label">Timezone</span>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary">{TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <div className="space-y-1.5 rounded-control border border-border bg-surface-subtle/40 p-3">
              <label className="block space-y-1 text-sm"><span className="soc-label">Workspace / tenant name</span>
                <div className="flex gap-2">
                  <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Acme SOC" className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" />
                  <Button size="sm" variant="secondary" onClick={saveTenant} disabled={busy !== "" || !tenantDirty}>{busy === "tenant" ? <Loader2 className="animate-spin" /> : <Save />} Rename</Button>
                </div></label>
              <p className="text-[11px] text-muted-foreground">Shown in the header and workspace switcher. Applies to this tenant across the console.</p>
            </div>
            <div className="soc-inset p-3 text-xs"><p className="soc-label">Tenant ID</p><p className="mt-1 break-all font-mono">{who.tenant_id}</p></div>
          </div>
        </Panel>

        <Panel title="Profile" eyebrow="Signed in">
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><User className="size-5" /></span>
              <div><p className="font-medium">{who.user_id}</p><p className="text-xs capitalize text-muted-foreground">{who.role}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="soc-inset p-3"><p className="soc-label">Role</p><p className="mt-1 font-medium capitalize">{who.role}</p></div>
              <div className="soc-inset p-3"><p className="soc-label">Sources</p><p className="mt-1 font-medium">{connectedSources}</p></div>
              <div className="soc-inset p-3"><p className="soc-label">Denied</p><p className="mt-1 font-medium">{denied}</p></div>
            </div>
            <button type="button" onClick={() => router.push("/integrations")} className="text-xs text-primary hover:underline">Manage integrations →</button>
          </div>
        </Panel>

        <Panel title="Preferences" eyebrow="Saved to tenant">
          <div className="divide-y divide-border">
            {[
              { key: "incident_notifications" as const, label: "Incident notifications", desc: "Alert me when a new incident is raised" },
              { key: "daily_digest" as const, label: "Daily digest", desc: "Email a summary each morning" },
              { key: "weekly_report" as const, label: "Weekly report", desc: "Auto-generate a weekly executive report" },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <span><span className="block text-sm font-medium">{row.label}</span><span className="block text-xs text-muted-foreground">{row.desc}</span></span>
                <button type="button" disabled={busy === "prefs"} onClick={() => togglePref(row.key)} className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${prefs[row.key] ? "bg-primary" : "bg-surface"}`}><span className={`block size-5 rounded-full bg-white transition ${prefs[row.key] ? "translate-x-5" : ""}`} /></button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Access & permissions" eyebrow="RBAC" action={<StatusLabel tone="violet">{who.permissions.length}</StatusLabel>}>
          <div className="flex flex-wrap gap-1.5 p-4">
            {who.permissions.length ? who.permissions.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 rounded-control border border-border bg-surface px-2 py-1 text-[11px]"><KeyRound className="size-3 text-primary" /> {titleCase(p)}</span>
            )) : <p className="text-sm text-muted-foreground">No explicit permissions.</p>}
          </div>
          <div className="space-y-2 border-t border-border p-4 text-xs">
            <p className="flex items-center gap-2"><Shield className="size-3.5 text-low" /> Tenant boundaries enforced on every query.</p>
            <p className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-low" /> Destructive actions gated by human approval.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
