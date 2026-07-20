# 00 — Competitive Analysis: Vinci Logic (feature extraction)

Source: product marketing site + application screenshots. This document reconstructs the
**full feature surface** of Vinci Logic so Aegis can ship a superset. Nothing here is
copied product; it is a functional teardown used to define our own requirements.

---

## 1. Positioning & messaging

- **Tagline:** *"Building Tomorrow's AI-Powered SOC for Today's Organizations."*
- **Value prop:** *"Empower Your SOC with Detection and Response as Code and AI-Powered
  Automation."*
- **Category:** AI-driven SecOps platform for building an **autonomous SOC**, based on an
  **Open XDR** architecture.
- **Core promise:** security teams *define how alerts are detected, qualified,
  investigated, and resolved* — as code.

## 2. Pillars (from the marketing site)

1. **Customizable response flows** — automate security responses for any alert type:
   from notifications, to threat blocking, to disabling compromised accounts.
2. **Integrated automation & AI** — an AI SOC agent automates the security response flow,
   reducing analyst workload.
3. **Automate & simplify threat detection** — built-in **SOAR**: automated alert triage
   and threat response. Uses **LLMs to turn disparate security signals into coherent
   attack narratives and complete summaries.**
4. **AI SOC agent — "AvicennAI"** — manages the *entire lifecycle* of security alerts.
   Example insight card shows:
   - **Insight:** "User jane.doe executed an obfuscated PowerShell script that attempted
     to access LSASS memory — a technique often used for credential dumping. Process
     started shortly after an unusual login from external IP (89.45.22.101)."
   - **Reasoning:** matches Mimikatz patterns; **MITRE ATT&CK T1003.001**; same user
     active on two other hosts within 15 min → possible lateral movement.
   - **Suggested action:** isolate host, suspend user account, initiate credential reset,
     review other endpoints.
5. **Vibe Detection & Response Engineering** — AI assistant helps teams *quickly design
   optimized detection rules and response workflows*.
6. **Flexible, scalable, cost-effective security Datalake** — deploy as an **autonomous
   SIEM** or integrated with existing Datalakes. **Native support for OpenSearch,
   ClickHouse**, and other modern backends. "Detection where the data lives," reducing
   cost and vendor lock-in vs. traditional SIEM.
7. **Complete security integration** — log collectors, operational tools, automation
   connectors, cloud infrastructure. Continuously evolving detection content.

## 3. Application feature surface (from the app screenshots)

### 3.1 Navigation / IA
Left sidebar, grouped:
- **Main:** Dashboard · Rules · Incidents · Cases · Assets · Automation (expandable) ·
  Investigations (expandable) · Reports · AI Assistant
- **Manage:** Integrations · Configurations · Settings
- **Account:** org identity shown as `admin@sekera-group.com` (single tenant visible).

### 3.2 Integrations
- Header stats: **Total Integrations (8) · Connected (4) · Issues (1)**.
- Tabs: **All · Cloud Services · Security · Monitoring**.
- Connectors seen: **AWS** (CloudTrail, GuardDuty, SecurityHub), **Microsoft Azure**
  (Security Center/Monitor), **Google Cloud Platform** (Security Command Center),
  **Kubernetes**, **Cloudflare** (WAF events), **Docker** (container security),
  **Datadog**, **Okta** (IAM).
- Per-connector state: **Connected / Disconnected / Error**, plus a **Configure** action.
- Primary action: **+ Add Integration**.

### 3.3 Incidents
- Title: "Monitor and manage security incidents." Search + Filter.
- Cards show: **title, Incident ID, Rule ID, description, tags, Detection Details
  (detected timestamp, severity), Assigned To (analyst), Status (Open/Resolved)**.
- Severity color rail on the left (red = high, amber = medium).
- Examples: *Windows DC Sync Attack Detected* (High, Open), *Impossible Travel in
  Office 365* (Medium, Open), *MFA Fatigue Attack* (High, Resolved).

### 3.4 Cases
- Title: "Track and manage security cases." Search + Filter.
- Cards show: **title, CASE-ID (CASE-001…), status (Open / In Progress / Closed),
  description, tags, timestamp, assignee**.
- Cases are the analyst-facing investigation container (an incident promoted to work).

### 3.5 Assets
- Asset inventory (endpoints, users, hosts) — referenced by rules/incidents
  (e.g., "Host WIN-02", "user jane.doe").

### 3.6 Rules (the core of "detection as code")
- Table columns: **Title, Severity, Created, Updated, Status (Enabled/Disabled),
  Author, Actions**. Grid/table toggle. Search + Columns + Filter. Pagination.
- Rules carry **tags** (`credential_access`, `windows`, `attack.initial_access`,
  `TDR-3006`, `discovery`, MITRE technique IDs like `T1110.003`, "Password Spraying",
  "Brute Force", …).
- **+ Rule** opens a **"Select Rule Type"** modal with six types:
  1. **Query Rule** — search queries + pattern matching.
  2. **Threshold Rule** — values exceeding thresholds.
  3. **Source Monitor** — monitor specific log sources for events/patterns.
  4. **Threat Match** — match events against known threat indicators (IOC feeds).
  5. **Code Based** — custom detection logic in **Python**.
  6. **Spark rules** — rules using **Lucene + Apache Spark**.

### 3.7 Rule editor
- Split view: **YAML source (left)** + **Details/metadata panel (right)**.
- Actions: **Save Changes · Duplicate · Disable · Delete**.
- Right-panel tabs: **Details · Folders · Upload rule · Assistant**.
- **Details** fields: Title, Severity (dropdown), Tags (chips), Description,
  Status toggle (Enabled).
- **YAML schema observed** (very important — Aegis mirrors + extends this):
  ```yaml
  title: Systems using many different protocols
  rule_id: 5c5a4a5f-79e8-48aa-8ac9-cb9255d7ad11
  severity: low
  version: 1
  effort_level: elementary
  confidence: High
  maturity: production
  enabled: true
  learning_mode: false
  capabilities:
    - Attack pattern
    - Threat
  author: admin@sekera-group.com
  creation_date: 2023/07/10
  updated_date: 2023/07/25
  description: Local system connecting to the internet on more than 50 DST ports in one hour...
  note: Note here
  integration: fortinet
  tags:
    - attack.initial_access
    - TDR-3006
    - discovery
  frequency: 15m
  depth: 15m
  timestamp_override: event.ingested
  indices:
    - syslog-fortinet-fw*
  type: advanced_threshold
  query: event.category:network AND event.type:allowed AND event.action:accept AND ...
         AND NOT source.ip:(172.16.8.150 OR 172.16.8.50)
  exclusions:
    exclusion_1:
      query: source.ip:172.16.8.231 AND destination.ip:172.16.5.0\/24 AND destination.port:[... TO 3014]
      date: 2024/05/10
  ```
- **Folders** tab → rules are organized into folders/collections.
- **Upload rule** tab → import existing rules (Sigma-style bulk import implied).

### 3.8 Rule Assistant ("Vibe Detection")
- In-editor chat. Prompt example: *"Create a detection rule for systems using many
  different protocols unexpectedly."*
- Produces **"Generated rule code"** (full YAML) with an **"Apply the code"** button that
  writes it into the editor. This is NL → detection-as-code.

### 3.9 AI Assistant (global)
- Dedicated nav item. Chat interface to explain alerts, e.g.:
  *"Hey explain this alert to me → [timestamp] Suspicious PowerShell Execution on Host
  WIN-02"* → returns Insight + Reasoning (MITRE mapping) + Suggested Action.

### 3.10 Automation & Investigations (expandable menus)
- **Automation** → SOAR playbooks / response workflows / connectors (blocking, account
  disable, notifications).
- **Investigations** → hunt/query workspace, timeline, entity pivoting.

### 3.11 Reports
- Reporting: incident/case reports, executive summaries, metrics (MTTD/MTTR, coverage).

### 3.12 Configurations & Settings
- Tenant/org configuration, data source config, indices, users, API keys.

## 4. Data backends explicitly named
- **OpenSearch** and **ClickHouse** (native). Query language looks **Lucene/KQL-style**
  (`event.category:network AND ...`), with **ECS-like field names** (`source.ip`,
  `destination.port`, `event.action`, `event.ingested`).
- **Apache Spark** for heavy/batch rules. **Python** for code-based detections.

## 5. Feature checklist (what Aegis must match, at minimum)

- [ ] Detection-as-code with rich YAML schema + 6 rule types
- [ ] AI rule assistant (NL → rule, apply to editor)
- [ ] AI SOC agent covering full alert lifecycle (triage→investigate→respond→report)
- [ ] LLM-generated attack narratives + MITRE ATT&CK mapping
- [ ] Incidents + Cases workflow (assignment, status, tags, severity)
- [ ] Asset inventory tied to detections
- [ ] SOAR automation / response playbooks (notify, block, isolate, disable account)
- [ ] Integrations hub (AWS/Azure/GCP/K8s/Cloudflare/Docker/Datadog/Okta + more)
- [ ] Investigations / hunting workspace
- [ ] Reports & metrics
- [ ] OpenSearch + ClickHouse backends, "detect where data lives"
- [ ] Global AI assistant (explain alerts)
- [ ] Configurations / settings / API keys

## 6. Where Aegis deliberately goes further

1. **True multi-tenancy** with hard isolation (Postgres RLS, ClickHouse row policies,
   OpenSearch document-level security) — Vinci screenshots only show one org.
2. **Multi-agent crew** instead of one monolithic agent — specialized triage /
   investigation / threat-intel / response / detection-engineering / reporting agents
   with a supervisor. See [03-agents](03-agents.md).
3. **Explicit agent governance** — PreToolUse approval hooks on destructive actions,
   PostToolUse audit hooks, full agent trace + replay (Langfuse).
4. **Enterprise auth** — OIDC + SAML SSO + SCIM provisioning + fine-grained RBAC +
   tenant-scoped API keys.
5. **Open ingestion** — Vector-based, vendor-neutral pipeline; connect *any* SIEM/log
   source, not just the built-in set.
