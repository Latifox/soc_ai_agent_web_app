# infra — remote data plane + log shipping

Aegis is Docker-free. The data plane is managed/remote:

- **OpenSearch** — a managed or self-hosted cluster (Aiven, AWS OpenSearch, self-hosted VPS).
  Point `OPENSEARCH_URL` / `OPENSEARCH_USER` / `OPENSEARCH_PASSWORD` at it. Provision the events
  index template with `opensearch_setup.py`.
- **Supabase** — app metadata Postgres + Auth (cloud project). Schema in `supabase/migrations/`.

Log shipping (deploy standalone on the box that produces logs, no compose needed):

- `logstash/pipeline/aegis.conf` — Logstash pipeline → OpenSearch (`t-{tenant}-*`). See
  [`logstash/README.md`](logstash/README.md).
- `vector/vector.yaml` — Vector alternative.

Deploying the three app services (web / api / agents) → see [`../DEPLOY.md`](../DEPLOY.md).
