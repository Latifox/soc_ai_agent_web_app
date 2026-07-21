"use client";

import { useMemo, useState } from "react";
import { Bot, Database, Loader2, Plug, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, StatusLabel } from "@/components/soc/flagship-ui";
import type { IntegrationRecord } from "@/lib/api";

type Provider = "opensearch";

type Field = { key: string; label: string; placeholder: string; type?: string };

const SPECS: Record<
  Provider,
  { name: string; icon: typeof Database; blurb: string; fields: Field[]; defaults: Record<string, string> }
> = {
  opensearch: {
    name: "OpenSearch",
    icon: Search,
    blurb: "Search & correlation engine the crew queries over t-{tenant}-* indices.",
    fields: [
      { key: "url", label: "URL", placeholder: "http://localhost:9200" },
      { key: "user", label: "User", placeholder: "admin" },
      { key: "password", label: "Password", placeholder: "••••••", type: "password" },
    ],
    defaults: { url: "http://localhost:9200", user: "admin", password: "admin" },
  },
};

type Health = { ok?: boolean; latency_ms?: number; detail?: string; error?: string };

function toneFor(status?: string) {
  if (status === "connected") return "green" as const;
  if (status === "error") return "red" as const;
  return "neutral" as const;
}

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!resp.ok) throw new Error(`${resp.status}`);
  return resp.status === 204 ? null : resp.json();
}

function ConnectorCard({ provider, initial }: { provider: Provider; initial?: IntegrationRecord }) {
  const spec = SPECS[provider];
  const Icon = spec.icon;
  const initialConfig = (initial?.config ?? {}) as Record<string, unknown>;

  const [id, setId] = useState(initial?.id ?? "");
  const [status, setStatus] = useState(initial?.status ?? "disconnected");
  const [health, setHealth] = useState<Health>(((initial as unknown) as { health?: Health })?.health ?? {});
  const [agentAccess, setAgentAccess] = useState<boolean>(
    initialConfig.agent_access === undefined ? true : Boolean(initialConfig.agent_access),
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = { ...spec.defaults };
    for (const f of spec.fields) {
      if (initialConfig[f.key] !== undefined) seed[f.key] = String(initialConfig[f.key]);
    }
    return seed;
  });
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const [error, setError] = useState("");

  const config = useMemo(
    () => ({ ...values, port: values.port ? Number(values.port) : undefined, agent_access: agentAccess }),
    [values, agentAccess],
  );

  async function ensureId(): Promise<string> {
    if (id) return id;
    const created = (await backend("integrations", {
      method: "POST",
      body: JSON.stringify({ provider, name: spec.name, config }),
    })) as IntegrationRecord;
    setId(created.id);
    return created.id;
  }

  async function save() {
    setBusy("save");
    setError("");
    try {
      const current = id;
      if (current) {
        await backend(`integrations/${current}`, { method: "PATCH", body: JSON.stringify({ config }) });
      } else {
        await ensureId();
      }
    } catch {
      setError("Save failed — check you are signed in.");
    } finally {
      setBusy("");
    }
  }

  async function test() {
    setBusy("test");
    setError("");
    try {
      const current = await ensureId();
      // Persist the latest field values before probing.
      await backend(`integrations/${current}`, { method: "PATCH", body: JSON.stringify({ config }) });
      const result = (await backend(`integrations/${current}/test`, { method: "POST" })) as IntegrationRecord & {
        health?: Health;
      };
      setStatus(result.status);
      setHealth(result.health ?? {});
    } catch {
      setError("Test request failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Panel
      title={spec.name}
      eyebrow="Data connector"
      action={<StatusLabel tone={toneFor(status)}>{status === "connected" ? "Connected" : status === "error" ? "Error" : "Not tested"}</StatusLabel>}
    >
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <p className="text-xs leading-5 text-muted-foreground">{spec.blurb}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {spec.fields.map((field) => (
            <label key={field.key} className={field.key === "url" ? "col-span-2 space-y-1 text-sm" : "space-y-1 text-sm"}>
              <span className="soc-label">{field.label}</span>
              <input
                type={field.type ?? "text"}
                value={values[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(e) => setValues((c) => ({ ...c, [field.key]: e.target.value }))}
                className="h-9 w-full rounded-control border border-border bg-surface px-3 text-foreground outline-none focus:border-primary"
              />
            </label>
          ))}
        </div>

        <label className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-subtle/40 px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm">
            <Bot className="size-4 text-primary" />
            Allow Argus crew access
          </span>
          <input type="checkbox" checked={agentAccess} onChange={(e) => setAgentAccess(e.target.checked)} className="size-4 accent-primary" />
        </label>

        {health.detail || health.error ? (
          <p className={`text-xs ${status === "connected" ? "text-low" : "text-high"}`}>
            {status === "connected"
              ? `✓ ${health.detail}${health.latency_ms != null ? ` · ${health.latency_ms} ms` : ""}`
              : `✗ ${health.error ?? health.detail}`}
          </p>
        ) : null}
        {error ? <p className="text-xs text-high">{error}</p> : null}

        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" onClick={save} disabled={busy !== ""}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Plug />} Save
          </Button>
          <Button size="sm" variant="primary" onClick={test} disabled={busy !== ""}>
            {busy === "test" ? <Loader2 className="animate-spin" /> : <Plug />} Test connection
          </Button>
        </div>
      </div>
    </Panel>
  );
}

export function DataConnectors({ integrations }: { integrations: IntegrationRecord[] }) {
  const byProvider = (p: Provider) => integrations.find((i) => i.provider === p);
  return (
    <div className="grid gap-4 p-4 pb-0 lg:p-5 lg:pb-0">
      <ConnectorCard provider="opensearch" initial={byProvider("opensearch")} />
    </div>
  );
}
