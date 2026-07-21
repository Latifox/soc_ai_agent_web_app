"use client";

import { useState } from "react";
import { Loader2, Plug, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, StatusLabel } from "@/components/soc/flagship-ui";
import type { IntegrationRecord } from "@/lib/api";

type Health = { ok?: boolean; latency_ms?: number; detail?: string; error?: string };
type Row = IntegrationRecord & { health?: Health };

function tone(status: string) {
  if (status === "connected") return "green" as const;
  if (status === "error") return "red" as const;
  return "neutral" as const;
}

async function backend(path: string, method: string) {
  const resp = await fetch(`/api/backend/${path}`, { method, headers: { "content-type": "application/json" } });
  if (!resp.ok) throw new Error(String(resp.status));
  return resp.status === 204 ? null : resp.json();
}

export function IntegrationsList({ initial }: { initial: IntegrationRecord[] }) {
  const [rows, setRows] = useState<Row[]>(initial as Row[]);
  const [busyId, setBusyId] = useState("");

  async function test(id: string) {
    setBusyId(id);
    try {
      const updated = (await backend(`integrations/${id}/test`, "POST")) as Row;
      setRows((r) => r.map((row) => (row.id === id ? { ...row, ...updated } : row)));
    } catch {
      /* leave row unchanged */
    } finally {
      setBusyId("");
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await backend(`integrations/${id}`, "DELETE");
      setRows((r) => r.filter((row) => row.id !== id));
    } catch {
      /* leave row */
    } finally {
      setBusyId("");
    }
  }

  const connected = rows.filter((r) => r.status === "connected").length;

  return (
    <Panel
      title="Configured integrations"
      eyebrow="Live from the control plane"
      action={<StatusLabel tone="green">{connected}/{rows.length} connected</StatusLabel>}
    >
      <div className="soc-scrollbar overflow-x-auto">
        <table className="soc-table min-w-[720px]">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Name</th>
              <th>Status</th>
              <th>Health</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-mono text-xs uppercase text-muted-foreground">{row.provider}</td>
                <td className="text-sm font-medium">{row.name}</td>
                <td>
                  <StatusLabel tone={tone(row.status)}>
                    {row.status === "connected" ? "Connected" : row.status === "error" ? "Error" : "Disconnected"}
                  </StatusLabel>
                </td>
                <td className="max-w-[240px] truncate text-xs text-muted-foreground">
                  {row.health?.detail ?? row.health?.error ?? "—"}
                  {row.health?.latency_ms != null ? ` · ${row.health.latency_ms} ms` : ""}
                </td>
                <td>
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => test(row.id)} disabled={busyId === row.id}>
                      {busyId === row.id ? <Loader2 className="animate-spin" /> : <Plug />} Test
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => remove(row.id)} disabled={busyId === row.id}>
                      <Trash2 />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No integrations configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
