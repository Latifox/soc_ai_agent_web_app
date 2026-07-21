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
            No live telemetry yet. Connect OpenSearch and grant the crew access to stream event volume,
            sources, and categories straight from your datalake.
          </p>
          <Button size="sm" variant="primary" onClick={() => router.push("/integrations")}>
            <Plug /> Connect a data source
          </Button>
        </div>
      </Panel>
    );
  }

  const peak = Math.max(1, telemetry.peak_per_hour, ...telemetry.timeline.map((b) => b.count));
  const maxSource = Math.max(1, ...telemetry.top_sources.map((s) => s.count));
  const avg = telemetry.timeline.length ? Math.round(telemetry.total_events / telemetry.timeline.length) : 0;
  const activeHours = telemetry.timeline.filter((b) => b.count > 0).length;

  const stats = [
    { label: "Total", value: compact(telemetry.total_events) },
    { label: "Peak / hr", value: compact(telemetry.peak_per_hour) },
    { label: "Avg / hr", value: compact(avg) },
    { label: "Active hrs", value: `${activeHours}/${telemetry.window_hours}` },
  ];

  return (
    <Panel
      title="Ingest telemetry"
      eyebrow={`Last ${telemetry.window_hours}h · live from OpenSearch`}
      action={<StatusLabel tone="green">{compact(telemetry.total_events)} events</StatusLabel>}
    >
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,1fr)]">
        <div className="min-w-0">
          <div className="mb-3 grid grid-cols-4 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="soc-inset px-3 py-2">
                <p className="soc-label">{s.label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
          <p className="soc-label mb-2">Events per hour</p>
          {telemetry.timeline.length ? (
            <>
              <div className="flex h-28 items-end gap-[3px]">
                {telemetry.timeline.map((b, i) => (
                  <div key={b.bucket} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${b.label ?? hourLabel(b.bucket)} · ${b.count} events`}>
                    <div
                      className={`w-full rounded-sm transition ${b.count > 0 ? "bg-primary/70 group-hover:bg-primary" : "bg-surface"}`}
                      style={{ height: `${b.count > 0 ? Math.max(6, (b.count / peak) * 100) : 3}%` }}
                    />
                    <span className="mt-1 hidden text-center text-[8px] text-muted-foreground sm:block">
                      {i % 4 === 0 ? (b.label ?? hourLabel(b.bucket)) : " "}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No events in the window.</p>
          )}
        </div>

        <div className="space-y-4 lg:border-l lg:border-border lg:pl-5">
          {telemetry.threat_signals && telemetry.threat_signals.length > 0 ? (
            <div>
              <p className="soc-label mb-2">Threat signals ({telemetry.window_hours}h)</p>
              <div className="grid grid-cols-2 gap-2">
                {telemetry.threat_signals.map((t) => (
                  <div key={t.key} className="soc-inset flex items-center justify-between gap-2 px-2.5 py-1.5">
                    <span className="truncate text-[11px] text-muted-foreground">{t.name}</span>
                    <span className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${t.count > 100 ? "text-high" : "text-foreground"}`}>{compact(t.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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
