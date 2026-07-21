"use client";

import { useState } from "react";
import { Loader2, Play, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, StatusLabel } from "@/components/soc/flagship-ui";

type Row = Record<string, unknown>;

async function runSearch(query: string): Promise<{ rows: Row[]; count: number }> {
  const resp = await fetch("/api/backend/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ engine: "opensearch", query, size: 20 }),
  });
  if (!resp.ok) throw new Error(String(resp.status));
  const data = (await resp.json()) as { rows: Row[]; count: number };
  return data;
}

export function LiveDataPreview() {
  const [query, setQuery] = useState("*");
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const data = await runSearch(query);
      setRows(data.rows ?? []);
      setCount(data.count ?? 0);
    } catch {
      setRows([]);
      setCount(0);
      setError("No live data — connect OpenSearch above and ingest events.");
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
          <span className="flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-xs text-primary">
            <Search className="size-3.5" /> OpenSearch · Lucene
          </span>
          <Button size="sm" variant="primary" onClick={run} disabled={busy} className="ml-auto">
            {busy ? <Loader2 className="animate-spin" /> : <Play />} Run
          </Button>
        </div>

        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={2}
          spellCheck={false}
          placeholder="event.action:failed_login AND source.ip:203.0.113.66"
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
