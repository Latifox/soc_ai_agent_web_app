# Aegis Flagship Frontend Design

**Status:** Approved for implementation on July 20, 2026.

**Visual source:** [Aegis Investigation Canvas](assets/aegis-investigation-canvas.png), selected by the user from the July 20, 2026 ideation set.

## Product outcome

Create a cohesive, flagship-quality operator console for Aegis that makes autonomous security operations legible and controllable. A Tier 1/2 analyst must be able to move from prioritized signal, to evidence-backed attack story, to a safe response decision without losing context. The current backend is not complete, so the frontend will use typed, realistic local fixtures and deterministic client interactions while preserving clean boundaries for later API replacement.

The implementation covers every route already defined in `apps/web`. It does not add authentication, persistence, production API calls, OpenUI packages, Monaco, or new backend services. Those integrations remain compatible follow-on work; this pass builds the complete product experience and interaction model they will inhabit.

## Design principles

1. **Work before metrics.** The active queue, selected object, evidence, and required decision dominate the viewport. Metrics are compact supporting context.
2. **One console, many workspaces.** Every route uses the same shell, command bar, typography, tokens, row language, filters, panels, and status semantics.
3. **Argus is an accountable operator.** AI output always identifies its source, confidence, evidence, current state, and whether a human approval is required.
4. **Severity is semantic.** Violet marks brand, active navigation, selection, and safe primary actions. Red, amber, green, and blue remain reserved for security severity and state.
5. **Dense, not cramped.** Information is grouped through alignment, dividers, and surface changes before borders or cards. Technical data remains scannable at 14px.
6. **Safe actions are explicit.** Destructive actions show target, consequence, auditability, and a distinct approve/reject choice.

## Visual system

The existing `DESIGN.md` tokens remain authoritative. Dark mode is the default, using `#0B0B0F`, `#141418`, `#18181B`, and `#27272A`; light mode has full parity. Brand violet is `#7C3AED` with `#8B5CF6` as the secondary accent. Inter is used for interface copy and JetBrains Mono for IDs, times, IPs, hashes, YAML, and technical metadata.

The selected visual is a 1536 x 1080 desktop frame. The product shell consists of a 164px expanded sidebar, a 56px top command bar, and a remaining workspace that can divide into queue, canvas, and context rail. Existing 12px card, 8px control, and 4px spacing tokens remain. Shadows are minimal; borders are subtle; there are no gradients, glow effects, decorative illustrations, or marketing-style hero sections.

Icons use the existing Lucide React dependency. Aegis does not need raster artwork for the console; the selected source contains only interface glyphs and a shield mark, all covered by the icon library.

## Application shell

### Sidebar

The sidebar retains the documented Main and Manage groups, a violet shield brand, active-route tint, collapse behavior, and account area. Expanded desktop width is compact enough to keep the work area dominant. On tablet widths it becomes an icon rail; on mobile it becomes a dismissible overlay opened from the header.

### Command bar

The top bar replaces breadcrumb-first chrome with a global command/search field. It accepts incident IDs, case IDs, rules, entities, IPs, and hashes. Results are grouped, keyboard navigable, and link to their relevant route. The right side shows current UTC time, live-system status, notification count, help, theme control, and analyst identity. Breadcrumb context appears within workspace headers when useful.

### Workspace frame

Routes select one of three reusable layouts:

- **Tri-pane:** priority list, primary canvas, context/action rail. Used by Dashboard, Incidents, Cases, Investigations, and AI Assistant.
- **Dense index:** compact page header, toolbar, table or grouped rows, optional inspector drawer. Used by Rules, Assets, Integrations, Reports, Configurations, and Settings.
- **Builder:** library rail, editable canvas, run/approval inspector. Used by Automation.

## Shared component architecture

- `WorkspaceHeader` owns title, description, object state, metadata, and page actions.
- `PriorityQueue` renders selectable, severity-aware work items with keyboard focus and active state.
- `InspectorPanel` provides a consistent right rail for entities, MITRE mappings, confidence, health, or settings.
- `StatusPill` and `SeverityIndicator` are the sole semantic state primitives.
- `Toolbar`, `SearchField`, `FilterMenu`, and `SegmentedControl` provide the shared query language.
- `DataTable` provides sticky headers, dense rows, sorting, selection, responsive column priority, and empty states.
- `Timeline` presents typed events with category colors, technical metadata, and optional filtering.
- `ApprovalPanel` presents the proposed action, target, risk, audit note, selected actions, and approve/reject controls.
- `Metric` presents compact operational values without defaulting to a card grid.
- `EmptyState`, `LoadingState`, and `Notice` provide intentional non-happy paths.

## Route designs

### Dashboard

The dashboard is a command center, not an analytics collage. A compact posture strip shows open incidents, critical count, mean time to triage, pending approvals, and Argus auto-resolution rate. The main surface combines the highest-priority incident queue with an operational timeline and a right rail summarizing Argus activity and work that needs human attention. Selecting an incident updates the narrative and context without navigation.

### Incidents

Incidents use the approved tri-pane model. The left queue supports search, severity, status, source, and assignee filters. The center shows the selected incident header, Argus attack narrative, and tabs for timeline, evidence, correlations, and notes. The right rail shows affected entities, MITRE mappings, confidence, and the containment approval. Selecting a queue item, changing tabs, filtering events, toggling benign events, approving, and rejecting are functional local interactions.

### Cases

Cases retain the tri-pane model but emphasize ownership and collaboration. The queue shows SLA status and assignee. The canvas contains case summary, activity timeline, linked evidence, and comments. The right rail contains linked incidents/entities, collaborators, and case actions. Local status changes and comment entry provide deterministic visible feedback.

### Investigations

Investigations most closely reproduces the selected visual. It includes the priority queue, detailed attack story, typed timeline filters, entity pivots, MITRE mapping, confidence, and containment recommendation. Timeline zoom controls are simplified to fit the working prototype: filters, benign-event toggle, and row selection are functional; decorative pan/zoom is omitted.

### Rules

Rules use a dense sticky-header table with title, severity, type, MITRE tags, updated time, state, author, and row actions. Search, severity/state filters, sorting, list/grid toggle, and pagination work locally. “New rule” opens a six-type modal matching the specification. Selecting a rule opens a split inspector with metadata and a dark YAML preview. Full Monaco editing and schema linting are deferred to the dedicated editor integration.

### Assets

Assets provide a table of hosts, users, identities, IPs, cloud resources, risk, exposure, last seen time, and linked detections. Selecting an entity opens an inspector with risk factors, relationships, and recent activity. Entity-type and risk filters work locally.

### Automation

Automation uses a builder layout: playbook list, central sequence of triggers/conditions/actions, and a right inspector with approval policy and run status. The visible playbook can be enabled/disabled and test-run locally. A pending-approvals segment reuses `ApprovalPanel`.

### Integrations

Integrations show total, connected, and issue counts in a compact header, then category tabs and a clean connector list/grid. AWS, Azure, GCP, Kubernetes, Cloudflare, Docker, Datadog, and Okta appear with realistic health and event-volume data. Search, category tabs, and state filters work. Configure opens a safe local modal; no credential collection or persistence is implemented.

### Reports

Reports prioritize operational decisions: MTTD/MTTR trend, alert disposition, Argus automation rate, and MITRE coverage. Charts are built with semantic HTML/CSS and accessible labels rather than a new chart dependency. Date-range and report-type controls update deterministic fixture views. Export is represented by a downloadable local summary rather than PDF generation.

### AI Assistant

The assistant is a generative-UI preview consistent with `docs/09-chat-generative-ui.md`. A thread list sits left, the conversation and composed security components occupy the center, and source/context scope sits right. The fixture conversation renders an alert card, MITRE table, investigation timeline, rule diff, and approval prompt. Composer submission appends a user message and a deterministic streamed-looking Argus response. Real OpenUI/AgentOS streaming remains a later integration.

### Configurations and Settings

Configurations cover data sources, retention, ingestion, and indices. Settings cover profile, organization, users, roles, API keys, SSO/SCIM, audit log, and appearance. Both use a settings rail and focused content panels with locally functional toggles, tabs, and safe forms. Secret values are never shown in fixtures.

## Data and state

All realistic demo content lives in typed modules under `src/data`. Route components consume shared domain types for severity, status, incidents, cases, rules, entities, integrations, timelines, approvals, and agent events. Client state is deliberately local and ephemeral. A future query/API layer can replace fixture imports without changing component contracts.

Filters are derived state. Selections use stable IDs. Approval and mutation simulations use a short pending state followed by a success notice and updated local status. No control implies persistence beyond the current browser session.

## Responsive behavior

- At 1280px and above, all three panes can be visible.
- From 900px to 1279px, the right inspector becomes an overlay drawer and the sidebar becomes an icon rail.
- Below 900px, the queue and canvas become stacked route-level views; the sidebar is an overlay and noncritical table columns hide by declared priority.
- Primary actions, severity, status, assignee, and identifiers remain visible. Horizontal scrolling is limited to technical tables and code previews.

## Accessibility

The console targets WCAG 2.2 AA behavior. Every interactive element is a native control or link, icon-only controls have accessible names, visible focus uses the ring token, color is never the only state cue, and all statuses include text. Tables use proper headers. Tabs and dialogs support expected keyboard behavior. Live approval outcomes and simulated agent responses use polite live regions. Motion respects `prefers-reduced-motion`.

## Error, loading, and empty states

Each data surface has a compact skeleton, meaningful empty state, and inline retry notice. Fixture mode does not randomly fail, but components expose an error presentation for later data-layer use. Search with no matches explains which filters are active and offers a reset. Disabled destructive actions explain the missing prerequisite.

## Verification

The implementation must pass ESLint, TypeScript type checking, and the Next.js production build. Automated tests cover fixture filtering, route navigation configuration, critical interactive components, and accessible names where the chosen test stack permits. Visual QA compares the `/investigations` route at the selected source viewport against the approved image, then checks `/dashboard`, `/rules`, `/incidents`, `/integrations`, and `/assistant` at desktop and mobile widths. Browser-based visual verification is required for a final pass; if the browser surface remains unavailable, the build can be technically verified but the visual QA status must remain blocked rather than claimed as passed.

