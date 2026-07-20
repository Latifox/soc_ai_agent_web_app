# 06 — Detection Engine (Detection-as-Code)

Rules are versioned YAML artifacts (mirroring the Vinci schema in [00 §3.7](00-competitive-analysis.md),
extended). The engine validates, compiles, schedules, backtests, and correlates them.

## 1. Rule types (6)

| Type | `type:` | Compiles to | Use |
|------|---------|-------------|-----|
| **Query** | `query` | ClickHouse SQL / OpenSearch DSL | pattern match on events |
| **Threshold** | `advanced_threshold` | ClickHouse SQL (GROUP BY + HAVING) | value/count over window (e.g. >50 dst ports/hr) |
| **Source Monitor** | `source_monitor` | ClickHouse/OpenSearch | watch a log source for events/absence |
| **Threat Match** | `threat_match` | join vs IOC table | match events to threat indicators |
| **Code** | `code` | Python | custom logic the DSL can't express |
| **Spark** | `spark` | Lucene + PySpark job | heavy/batch analytics |

## 2. Rule YAML schema (canonical)

```yaml
title: Systems using many different protocols
rule_id: 5c5a4a5f-79e8-48aa-8ac9-cb9255d7ad11   # UUID, stable
severity: low                                    # low|medium|high|critical
version: 1                                        # bumped on save
effort_level: elementary
confidence: High
maturity: production                              # experimental|test|production
enabled: true
learning_mode: false                              # run silently to baseline
capabilities: [Attack pattern, Threat]
author: priya@acme.com
creation_date: 2023/07/10
updated_date: 2023/07/25
description: >
  Local system connecting to the internet on more than 50 DST ports in one hour...
note: analyst note
integration: fortinet                             # source hint
tags: [attack.initial_access, TDR-3006, discovery, T1046]   # incl. MITRE technique ids
frequency: 15m                                    # schedule cadence
depth: 15m                                         # lookback window
timestamp_override: event.ingested
indices: [syslog-fortinet-fw*]                     # logical indices / CH source filter
type: advanced_threshold
threshold:                                         # (threshold type)
  group_by: [source.ip]
  aggregate: cardinality(destination.port)
  operator: ">"
  value: 50
query: >
  event.category:network AND event.type:allowed AND event.action:accept
  AND NOT source.ip:(172.16.8.150 OR 172.16.8.50)
exclusions:
  exclusion_1:
    query: source.ip:172.16.8.231 AND destination.ip:172.16.5.0\/24 AND destination.port:[* TO 3014]
    date: 2024/05/10
response:                                          # optional linked playbook
  playbook: notify-and-enrich
mitre: [T1046]                                     # explicit mapping (also from tags)
```

- Query language is **KQL/Lucene-style** over **ECS** fields; the compiler translates to
  the target backend. `code`/`spark` rules carry a body instead of `query`.

## 3. Compilation targets
- **ClickHouse (chdb local / server prod):** query/threshold/source-monitor/threat-match →
  parameterized SQL with a mandatory `tenant_id` + `ts` window prefix.
- **OpenSearch DSL:** same rules for federated/estate detection.
- **Python (`code`):** sandboxed function `detect(ctx) -> list[Detection]` with a scoped
  ClickHouse/OpenSearch client (tenant-bound).
- **Spark:** generated PySpark job for batch windows.

The ClickHouse Agent Skills ([10](10-external-tools.md)) keep generated SQL correct/optimized.

## 4. Runtime
1. **Scheduler** (per tenant) runs each enabled rule on its `frequency` over `depth`.
2. **Execute** compiled query; apply `exclusions`.
3. Emit **detections** (ClickHouse) with entities + `event_ids` + MITRE.
4. **Correlate** detections (same entity/time/rule-family) → **Incident** (Postgres).
5. **learning_mode: true** → run + record stats, no alert (for baselining/tuning).

## 5. Backtest & test
- **Backtest:** run a rule over historical ClickHouse data (e.g. 30 days) from the editor;
  return row-level hits < 10s target. Powers the Vibe assistant "try before enable".
- **Unit tests:** rule fixtures (sample events → expected detections) run in CI.
- **Coverage:** MITRE ATT&CK matrix view of techniques with ≥1 active rule.

## 6. Authoring UX (see teardown §3.6–3.8)
- **Rule-type modal** → Monaco YAML split view + Details/Folders/Upload/Assistant tabs.
- **Vibe Detection assistant** (Detection-Engineering agent): NL → generated YAML →
  `RuleDiff` preview ([09](09-chat-generative-ui.md)) → **Apply** → backtest → Save (version bump).
- **Folders** organize rules; **Upload/Import** supports **Sigma** → Aegis YAML.
- Lifecycle: enable/disable, duplicate, delete, version history.

## 7. Extensibility
- New backend = new compiler implementing `compile(rule) -> BackendQuery`.
- Rule packs (curated content) distributable per tenant; continuous content updates.
