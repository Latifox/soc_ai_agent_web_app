"use client";

import { Database, Plug } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Panel, StatusLabel } from "@/components/soc/flagship-ui";
import type { TelemetryOverview } from "@/lib/api";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function hourLabel(bucket: string): string {
  const d = new Date(bucket.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:00`;
}

export function TelemetryPanel({ telemetry }: { telemetry: TelemetryOverview }) {
  const router = useRouter();

  if (!telemetry.available) {
    return (
      <Panel title="Ingest telemetry" eyebrow="Live from connected stores" action={<StatusLabel tone="neutral">No source</StatusLabel>}>
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Database className="size-5" />
          </span>
          <p className="max-w-md text-sm text-muted-foreground">
            No live telemetry yet. Connect ClickHouse and grant the crew access to stream event volume,
            sources, and categories straight from your datalake.
          </p>
          <Button size="sm" variant="primary" onClick={() => router.push("/integrations")}>
            <Plug /> Connect a data source
          </Button>
        </div>
      </Panel>
    );
  }

  const peak = Math.max(1, ...telemetry.timeline.map((b) => b.count));
  const maxSource = Math.max(1, ...telemetry.top_sources.map((s) => s.count));

  return (
    <Panel
      title="Ingest telemetry"
      eyebrow={`Last ${telemetry.window_hours}h · live from ClickHouse`}
      action={<StatusLabel tone="green">{compact(telemetry.total_events)} events</StatusLabel>}
    >
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <p className="soc-label mb-2">Events per hour</p>
          {telemetry.timeline.length ? (
            <div className="flex h-32 items-end gap-1">
              {telemetry.timeline.map((b) => (
                <div key={b.bucket} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[9px] text-muted-foreground opacity-0 transition group-hover:opacity-100">{b.count}</span>
                  <div
                    className="w-full rounded-t bg-primary/70 transition group-hover:bg-primary"
                    style={{ height: `${Math.max(4, (b.count / peak) * 100)}%` }}
                    title={`${hourLabel(b.bucket)} · ${b.count}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No events in the window.</p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="soc-label mb-2">Top sources</p>
            <div className="space-y-1.5">
              {telemetry.top_sources.length ? (
                telemetry.top_sources.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate font-mono text-[11px] text-muted-foreground">{s.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${(s.count / maxSource) * 100}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right font-mono text-[11px]">{compact(s.count)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>
          <div>
            <p className="soc-label mb-2">Top categories</p>
            <div className="flex flex-wrap gap-1.5">
              {telemetry.top_categories.length ? (
                telemetry.top_categories.map((c) => (
                  <span key={c.name} className="rounded-control border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground">
                    {c.name} <span className="font-mono text-foreground">{compact(c.count)}</span>
                  </span>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
