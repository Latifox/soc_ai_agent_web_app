# services/detection — Rule scheduler + compilers

Per-tenant scheduler; compiles YAML rules → ClickHouse SQL / OpenSearch DSL / Spark /
Python; correlation → incidents; backtest.

Scaffolded by tasks **BE-11 … BE-13** (see [`/TODO.md`](../../TODO.md)).
Spec: [`docs/06-detection-engine.md`](../../docs/06-detection-engine.md).
