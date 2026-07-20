# Aegis Flagship Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, responsive, dark-first Aegis SOC product demo across every existing web route, faithfully grounded in the approved Investigation Canvas.

**Architecture:** Typed fixture data feeds reusable SOC primitives and three workspace layouts: tri-pane, dense index, and builder. Route-level client components own ephemeral interaction state while the existing Next.js App Router pages remain thin entry points, leaving a clean replacement seam for future API/query integrations.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Lucide React, next-themes, Vitest, Testing Library.

## Global Constraints

- Preserve every token and guardrail in `DESIGN.md`; dark mode remains the default and light mode retains parity.
- Use brand violet only for identity, active selection, and primary actions; use severity colors only for semantic security state.
- Use Inter for interface text and JetBrains Mono only for IDs, timestamps, IPs, hashes, YAML, and technical values.
- Do not add gradients, glow effects, decorative illustrations, custom SVG, emoji, or marketing-style layouts.
- Every existing route under `apps/web/src/app/(app)` must become a realistic product surface with working primary local interactions.
- Do not implement authentication, persistence, production API calls, Monaco, OpenUI packages, AgentOS, or new backend services in this pass.
- Desktop target is the approved 1536 x 1080 visual; tri-pane layouts adapt at 1280px, 900px, and mobile breakpoints.
- Final technical gates are `pnpm --filter @aegis/web lint`, `typecheck`, `test`, and `build`.

---

### Task 1: Test Harness, Domain Types, and Fixture Data

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/data/types.ts`
- Create: `apps/web/src/data/fixtures.ts`
- Create: `apps/web/src/data/fixtures.test.ts`

**Interfaces:**
- Produces: `Severity`, `Incident`, `CaseRecord`, `Rule`, `Entity`, `Integration`, `TimelineEvent`, `Approval`, `AgentActivity`, and fixture arrays consumed by every later task.
- Produces: `filterIncidents(query, severity, status): Incident[]` and equivalent small selectors for rules, entities, and integrations.

- [ ] **Step 1: Add the frontend test dependencies and script**

```json
{
  "scripts": { "test": "vitest run" },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^26.1.0",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Write failing selector tests**

```ts
expect(filterIncidents("lsass", "all", "all")).toHaveLength(1);
expect(filterIncidents("", "critical", "investigating").every(
  (incident) => incident.severity === "critical" && incident.status === "investigating",
)).toBe(true);
```

- [ ] **Step 3: Run the focused test and verify failure**

Run: `pnpm --filter @aegis/web test -- src/data/fixtures.test.ts`

Expected: failure because `fixtures.ts` and its selectors do not exist.

- [ ] **Step 4: Implement domain types, realistic July 20, 2026 fixtures, and selectors**

```ts
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type WorkStatus = "new" | "triage" | "investigating" | "monitoring" | "resolved";
export function filterIncidents(query: string, severity: Severity | "all", status: WorkStatus | "all"): Incident[];
```

- [ ] **Step 5: Run the focused test and full TypeScript check**

Run: `pnpm --filter @aegis/web test -- src/data/fixtures.test.ts && pnpm --filter @aegis/web typecheck`

Expected: all selector tests pass and TypeScript reports no errors.

### Task 2: Visual Tokens and Reusable SOC Primitives

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/components/ui/status-pill.tsx`
- Create: `apps/web/src/components/ui/icon-button.tsx`
- Create: `apps/web/src/components/soc/severity-indicator.tsx`
- Create: `apps/web/src/components/soc/segmented-control.tsx`
- Create: `apps/web/src/components/soc/search-field.tsx`
- Create: `apps/web/src/components/soc/metric.tsx`
- Create: `apps/web/src/components/soc/notice.tsx`
- Create: `apps/web/src/components/soc/empty-state.tsx`
- Create: `apps/web/src/components/soc/primitives.test.tsx`

**Interfaces:**
- Consumes: `Severity` from Task 1.
- Produces: stable primitives used by the shell and every route.

- [ ] **Step 1: Write failing accessibility and interaction tests**

```tsx
render(<SegmentedControl value="all" onValueChange={onChange} options={[{ value: "all", label: "All" }]} />);
expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm --filter @aegis/web test -- src/components/soc/primitives.test.tsx`

Expected: failure because the SOC primitives do not exist.

- [ ] **Step 3: Extend the token system and implement primitives**

```ts
export interface SegmentOption<T extends string> { value: T; label: string; count?: number }
export function SegmentedControl<T extends string>(props: {
  value: T; options: SegmentOption<T>[]; onValueChange(value: T): void;
}): React.ReactNode;
```

Use only semantic tokens, native controls, visible focus, 150–200ms transitions, and a reduced-motion override.

- [ ] **Step 4: Run primitive tests, lint, and typecheck**

Run: `pnpm --filter @aegis/web test -- src/components/soc/primitives.test.tsx && pnpm --filter @aegis/web lint && pnpm --filter @aegis/web typecheck`

Expected: all checks pass.

### Task 3: Responsive App Shell and Global Command Search

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx`
- Modify: `apps/web/src/components/app-sidebar.tsx`
- Modify: `apps/web/src/components/app-header.tsx`
- Modify: `apps/web/src/components/sidebar-context.tsx`
- Modify: `apps/web/src/lib/nav.ts`
- Create: `apps/web/src/components/command-search.tsx`
- Create: `apps/web/src/components/system-status.tsx`
- Create: `apps/web/src/components/app-shell.test.tsx`

**Interfaces:**
- Consumes: route configuration and fixtures from Task 1; primitives from Task 2.
- Produces: fixed sidebar, command bar, responsive content frame, and global search navigation.

- [ ] **Step 1: Write failing shell tests**

```tsx
expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
await user.type(screen.getByRole("searchbox", { name: "Search Aegis" }), "LSASS");
expect(screen.getByRole("option", { name: /Credential Access via LSASS/i })).toBeVisible();
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm --filter @aegis/web test -- src/components/app-shell.test.tsx`

Expected: failure because command search is missing.

- [ ] **Step 3: Implement the approved compact shell**

```ts
export interface CommandResult { id: string; label: string; meta: string; href: string; group: "Incident" | "Case" | "Rule" | "Entity" }
```

Implement Escape-to-close, arrow-key result movement, mobile sidebar overlay, UTC clock, system health, notifications, theme toggle, and analyst menu.

- [ ] **Step 4: Verify shell tests and production checks**

Run: `pnpm --filter @aegis/web test -- src/components/app-shell.test.tsx && pnpm --filter @aegis/web lint && pnpm --filter @aegis/web typecheck`

Expected: all checks pass.

### Task 4: Investigation Primitives and Approved Investigation Canvas

**Files:**
- Create: `apps/web/src/components/soc/priority-queue.tsx`
- Create: `apps/web/src/components/soc/workspace-header.tsx`
- Create: `apps/web/src/components/soc/timeline.tsx`
- Create: `apps/web/src/components/soc/inspector-panel.tsx`
- Create: `apps/web/src/components/soc/approval-panel.tsx`
- Create: `apps/web/src/features/investigations/investigation-workspace.tsx`
- Modify: `apps/web/src/app/(app)/investigations/page.tsx`
- Create: `apps/web/src/features/investigations/investigation-workspace.test.tsx`

**Interfaces:**
- Consumes: incidents, timeline events, approval, and entities from Task 1.
- Produces: tri-pane components reused by Dashboard, Incidents, Cases, and Assistant.

- [ ] **Step 1: Write failing workflow tests**

```tsx
await user.click(screen.getByRole("button", { name: /PowerShell Remoting/i }));
expect(screen.getByRole("heading", { name: /PowerShell Remoting/i })).toBeVisible();
await user.click(screen.getByRole("button", { name: "Endpoint" }));
expect(screen.queryByText("Unusual interactive login")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm --filter @aegis/web test -- src/features/investigations/investigation-workspace.test.tsx`

Expected: failure because the workspace does not exist.

- [ ] **Step 3: Implement the selected visual faithfully**

```ts
type TimelineFilter = "all" | TimelineEvent["category"];
type ApprovalState = "pending" | "approving" | "approved" | "rejected";
```

Match the approved pane widths, header density, row heights, typography, selection states, and context rail. Implement queue selection, story/timeline/evidence tabs, typed event filters, benign-event toggle, selected event state, and approval/rejection feedback.

- [ ] **Step 4: Verify the workspace**

Run: `pnpm --filter @aegis/web test -- src/features/investigations/investigation-workspace.test.tsx && pnpm --filter @aegis/web lint && pnpm --filter @aegis/web typecheck`

Expected: the workflow test and static checks pass.

### Task 5: Dashboard, Incidents, and Cases

**Files:**
- Create: `apps/web/src/features/dashboard/dashboard-workspace.tsx`
- Create: `apps/web/src/features/incidents/incidents-workspace.tsx`
- Create: `apps/web/src/features/cases/cases-workspace.tsx`
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx`
- Modify: `apps/web/src/app/(app)/incidents/page.tsx`
- Modify: `apps/web/src/app/(app)/cases/page.tsx`
- Create: `apps/web/src/features/tri-pane-workspaces.test.tsx`

**Interfaces:**
- Consumes: Task 4 tri-pane primitives and Task 1 fixtures.
- Produces: three complete analyst workflows with local selection, filtering, approval, status, and comment state.

- [ ] **Step 1: Write failing route-workflow tests**

```tsx
render(<IncidentsWorkspace />);
await user.type(screen.getByRole("searchbox", { name: "Search incidents" }), "MFA");
expect(screen.getByText("MFA Fatigue / Push Bombing Detected")).toBeVisible();
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `pnpm --filter @aegis/web test -- src/features/tri-pane-workspaces.test.tsx`

Expected: failure because the route workspaces do not exist.

- [ ] **Step 3: Implement all three routes**

Dashboard: posture strip, priority queue, operations timeline, Argus activity, human-attention list. Incidents: filtered queue, selected incident detail, evidence tabs, context/approval rail. Cases: SLA queue, case activity, linked evidence, local comment form and status change.

- [ ] **Step 4: Verify route workflows and static checks**

Run: `pnpm --filter @aegis/web test -- src/features/tri-pane-workspaces.test.tsx && pnpm --filter @aegis/web lint && pnpm --filter @aegis/web typecheck`

Expected: all checks pass.

### Task 6: Dense Index System, Rules, Assets, and Integrations

**Files:**
- Create: `apps/web/src/components/soc/dense-table.tsx`
- Create: `apps/web/src/components/soc/modal.tsx`
- Create: `apps/web/src/features/rules/rules-workspace.tsx`
- Create: `apps/web/src/features/assets/assets-workspace.tsx`
- Create: `apps/web/src/features/integrations/integrations-workspace.tsx`
- Modify: `apps/web/src/app/(app)/rules/page.tsx`
- Modify: `apps/web/src/app/(app)/assets/page.tsx`
- Modify: `apps/web/src/app/(app)/integrations/page.tsx`
- Create: `apps/web/src/features/index-workspaces.test.tsx`

**Interfaces:**
- Consumes: rule, entity, and integration fixtures plus shared controls.
- Produces: accessible dense table and modal patterns reused by remaining management routes.

- [ ] **Step 1: Write failing search, filter, and dialog tests**

```tsx
render(<RulesWorkspace />);
await user.click(screen.getByRole("button", { name: "New rule" }));
expect(screen.getByRole("dialog", { name: "Select rule type" })).toBeVisible();
expect(screen.getAllByRole("button", { name: /rule/i })).toHaveLength(6);
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `pnpm --filter @aegis/web test -- src/features/index-workspaces.test.tsx`

Expected: failure because the index workspaces do not exist.

- [ ] **Step 3: Implement dense table, inspectors, and dialogs**

Rules: search/filter/sort/view toggle/pagination, six-type modal, YAML inspector. Assets: type/risk filters and entity inspector. Integrations: stats, category/state filtering, connector health, and configuration dialog.

- [ ] **Step 4: Verify index workflows**

Run: `pnpm --filter @aegis/web test -- src/features/index-workspaces.test.tsx && pnpm --filter @aegis/web lint && pnpm --filter @aegis/web typecheck`

Expected: all checks pass.

### Task 7: Automation, Reports, and AI Assistant

**Files:**
- Create: `apps/web/src/features/automation/automation-workspace.tsx`
- Create: `apps/web/src/features/reports/reports-workspace.tsx`
- Create: `apps/web/src/features/assistant/assistant-workspace.tsx`
- Modify: `apps/web/src/app/(app)/automation/page.tsx`
- Modify: `apps/web/src/app/(app)/reports/page.tsx`
- Modify: `apps/web/src/app/(app)/assistant/page.tsx`
- Create: `apps/web/src/features/advanced-workspaces.test.tsx`

**Interfaces:**
- Consumes: approval, rule, incident, timeline, and agent fixtures.
- Produces: builder interactions, accessible metric visualizations, and deterministic generative-UI chat preview.

- [ ] **Step 1: Write failing primary interaction tests**

```tsx
render(<AssistantWorkspace />);
await user.type(screen.getByRole("textbox", { name: "Message Argus" }), "Explain the LSASS alert");
await user.click(screen.getByRole("button", { name: "Send message" }));
expect(await screen.findByText(/I traced the credential-access sequence/i)).toBeVisible();
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @aegis/web test -- src/features/advanced-workspaces.test.tsx`

Expected: failure because the advanced workspaces do not exist.

- [ ] **Step 3: Implement the three routes**

Automation: playbook sequence, enable toggle, test run, approvals. Reports: range/type controls and accessible CSS-backed metrics. Assistant: thread selection, rendered security components, composer, and deterministic response state with polite live announcements.

- [ ] **Step 4: Verify advanced workflows**

Run: `pnpm --filter @aegis/web test -- src/features/advanced-workspaces.test.tsx && pnpm --filter @aegis/web lint && pnpm --filter @aegis/web typecheck`

Expected: all checks pass.

### Task 8: Configurations and Settings

**Files:**
- Create: `apps/web/src/components/soc/settings-layout.tsx`
- Create: `apps/web/src/features/configurations/configurations-workspace.tsx`
- Create: `apps/web/src/features/settings/settings-workspace.tsx`
- Modify: `apps/web/src/app/(app)/configurations/page.tsx`
- Modify: `apps/web/src/app/(app)/settings/page.tsx`
- Create: `apps/web/src/features/management-workspaces.test.tsx`

**Interfaces:**
- Consumes: shared dense-index components and shell theme control.
- Produces: accessible locally functional forms for data, retention, organization, RBAC, API keys, SSO/SCIM, audit, and appearance.

- [ ] **Step 1: Write failing management interaction tests**

```tsx
render(<SettingsWorkspace />);
await user.click(screen.getByRole("tab", { name: "Roles" }));
expect(screen.getByRole("heading", { name: "Roles and permissions" })).toBeVisible();
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm --filter @aegis/web test -- src/features/management-workspaces.test.tsx`

Expected: failure because settings workspaces do not exist.

- [ ] **Step 3: Implement settings layout and both routes**

Use native inputs, labeled toggles, safe masked values, local save feedback, and no simulated secrets.

- [ ] **Step 4: Verify management workflows**

Run: `pnpm --filter @aegis/web test -- src/features/management-workspaces.test.tsx && pnpm --filter @aegis/web lint && pnpm --filter @aegis/web typecheck`

Expected: all checks pass.

### Task 9: Full Verification and Design QA

**Files:**
- Create: `design-qa.md`
- Modify: any frontend file needed to resolve P0/P1/P2 comparison findings

**Interfaces:**
- Consumes: approved image and every implemented route.
- Produces: a technically verified build and blocking visual comparison report.

- [ ] **Step 1: Run the complete technical gate**

Run: `pnpm --filter @aegis/web test && pnpm --filter @aegis/web lint && pnpm --filter @aegis/web typecheck && pnpm --filter @aegis/web build`

Expected: all commands exit 0.

- [ ] **Step 2: Capture the approved comparison state**

Run the app and capture `/investigations` at 1536 x 1080 in the available in-app browser. Also capture `/dashboard`, `/rules`, `/incidents`, `/integrations`, and `/assistant` at desktop and a 390px mobile viewport.

- [ ] **Step 3: Compare and record findings**

Open the approved image and current `/investigations` capture together. Record layout, type, color, spacing, state, responsiveness, interaction, and accessibility findings in `design-qa.md`, classified P0 through P3.

- [ ] **Step 4: Fix all P0/P1/P2 findings and recapture**

Repeat same-viewport comparison until `design-qa.md` contains `final result: passed`. If browser capture remains unavailable, write `final result: blocked` and do not claim visual verification.

- [ ] **Step 5: Re-run the complete technical gate**

Run: `pnpm --filter @aegis/web test && pnpm --filter @aegis/web lint && pnpm --filter @aegis/web typecheck && pnpm --filter @aegis/web build`

Expected: all commands exit 0 after final visual fixes.

