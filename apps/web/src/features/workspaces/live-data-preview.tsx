"use client";

import { useState } from "react";
import { Database, Loader2, Play, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, StatusLabel } from "@/components/soc/flagship-ui";

type Engine = "clickhouse" | "opensearch";
type Row = Record<string, unknown>;

const DEFAULT_QUERY: Record<Engine, string> = {
  clickhouse: "SELECT * FROM events ORDER BY ts DESC LIMIT 20",
  opensearch: "*",
};

async function runSearch(engine: Engine, query: string): Promise<{ rows: Row[]; count: number }> {
  const resp = await fetch("/api/backend/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ engine, query, size: 20 }),
  });
  if (!resp.ok) throw new Error(String(resp.status));
  const data = (await resp.json()) as { rows: Row[]; count: number };
  return data;
}

export function LiveDataPreview() {
  const [engine, setEngine] = useState<Engine>("clickhouse");
  const [query, setQuery] = useState(DEFAULT_QUERY.clickhouse);
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function switchEngine(next: Engine) {
    setEngine(next);
    setQuery(DEFAULT_QUERY[next]);
    setRows([]);
    setCount(null);
    setError("");
  }

  async function run() {
    setBusy(true);
    setError("");
    try {
      const data = await runSearch(engine, query);
      setRows(data.rows ?? []);
      setCount(data.count ?? 0);
    } catch {
      setRows([]);
      setCount(0);
      setError(`No live data — connect ${engine === "clickhouse" ? "ClickHouse" : "OpenSearch"} above and ingest events.`);
    } finally {
      setBusy(false);
    }
  }

  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <Panel
      title="Live data preview"
      eyebrow="Straight from the connected store"
      action={count != null ? <StatusLabel tone={count > 0 ? "green" : "neutral"}>{count} rows</StatusLabel> : null}
    >
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-control border border-border">
            {(["clickhouse", "opensearch"] as Engine[]).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => switchEngine(e)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs capitalize ${engine === e ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {e === "clickhouse" ? <Database className="size-3.5" /> : <Search className="size-3.5" />}
                {e}
              </button>
            ))}
          </div>
          <Button size="sm" variant="primary" onClick={run} disabled={busy} className="ml-auto">
            {busy ? <Loader2 className="animate-spin" /> : <Play />} Run
          </Button>
        </div>

        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={2}
          spellCheck={false}
          className="w-full resize-y rounded-control border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary"
        />

        {error ? <p className="text-xs text-muted-foreground">{error}</p> : null}

        {rows.length ? (
          <div className="soc-scrollbar max-h-80 overflow-auto rounded-control border border-border">
            <table className="soc-table min-w-[640px]">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c} className="font-mono text-[11px] text-muted-foreground">
                        {typeof row[c] === "object" ? JSON.stringify(row[c]) : String(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : count === 0 && !error ? (
          <p className="rounded-control border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Query returned no rows.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
