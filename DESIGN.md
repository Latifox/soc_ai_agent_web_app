---
version: "aegis-soc-2026-07-20"
name: "Aegis — Autonomous AI SOC"
description: "Design system for Aegis, an AI-native Open XDR & autonomous SOC platform. A calm, high-density security operations UI: clean light surfaces with a violet brand accent, first-class dark mode for 24/7 ops, severity-driven color, and a monospace voice for detection-as-code. Suitable for dashboards, data tables, a YAML rule editor, and a generative-UI chat."
colors:
  primary: "#7C3AED"
  primary-hover: "#6D28D9"
  accent: "#8B5CF6"
  secondary: "#0F172A"
  background: "#FFFFFF"
  background-muted: "#FAFAFA"
  surface: "#F7F7F8"
  surface-raised: "#FFFFFF"
  text-primary: "#0A0A0B"
  text-secondary: "#71717A"
  border: "#E4E4E7"
  # dark mode
  dark-background: "#0B0B0F"
  dark-surface: "#141418"
  dark-surface-raised: "#18181B"
  dark-text-primary: "#FAFAFA"
  dark-text-secondary: "#A1A1AA"
  dark-border: "#27272A"
  # severity / status semantics
  severity-critical: "#DC2626"
  severity-high: "#EF4444"
  severity-medium: "#F59E0B"
  severity-low: "#10B981"
  severity-info: "#3B82F6"
  status-open: "#7C3AED"
  status-progress: "#F59E0B"
  status-resolved: "#10B981"
typography:
  display-lg:
    fontFamily: "Inter"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: "1.08"
    letterSpacing: "-0.02em"
  heading-md:
    fontFamily: "Inter"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "1.3"
  body-md:
    fontFamily: "Inter"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.6"
  label-md:
    fontFamily: "Inter"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "1.2"
    letterSpacing: "0.01em"
  code:
    fontFamily: "JetBrains Mono"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "1.5"
spacing:
  base: "4px"
  gap: "16px"
  card-padding: "20px"
  section-padding: "32px"
rounded:
  card: "12px"
  control: "8px"
  input: "8px"
  pill: "9999px"
components:
  sidebar:
    background: "Use background-muted (light) / dark-surface (dark); active item filled with a 10% primary tint and primary text; grouped sections (Main / Manage) with quiet label-md headers"
  card:
    background: "surface-raised with a 1px border token and a soft, low shadow"
    radius: "Match the card radius token (12px)"
    accent: "Incident/case cards carry a 3px left severity rail using the severity token"
  button:
    primary: "Solid primary background, white text, control radius; hover uses primary-hover"
    secondary: "Transparent with border token; text-primary"
    radius: "control radius; pills only for filters/tags/status"
  status-pill:
    background: "Tinted (~12%) severity/status color with the solid color as text"
  table:
    style: "Dense rows, sticky header on surface, subtle row borders, sortable columns, hover row highlight"
  editor:
    style: "Monaco YAML on a dark canvas even in light mode (code is dark); line numbers muted; violet caret/selection"
  chat:
    style: "OpenUI generative-UI surface; agent messages render component cards (AlertCard, MITRE table, ApprovalPrompt); user bubble uses primary; streaming shimmer"
---

# Aegis — Autonomous AI SOC

Brand voice: **precise, calm, and technical.** Aegis runs the Security Operations Center,
so the UI must read as trustworthy infrastructure, not a flashy marketing site. The mark is
a violet **shield**; the accent color is the only saturated hue in the chrome — everything
else is neutral so that **severity color carries meaning**, never decoration.

## Overview
Aegis is an AI-native Open XDR & autonomous SOC platform (detection-and-response as code +
an autonomous agent crew). The product surface is a dense operator console: Dashboard,
Rules, Incidents, Cases, Assets, Automation, Investigations, Reports, and an AI Assistant,
plus Manage (Integrations, Configurations, Settings). See [`README.md`](README.md) and
[`docs/`](docs/).

## Composition
Two-pane app shell: a fixed left **sidebar** (brand + grouped nav + account switcher) and a
scrollable content column with a breadcrumb header. Content is card- and table-driven.
Preserve high information density — analysts scan; do not pad pages into generic SaaS
hero+features layouts. First screen of any page should surface actionable state (counts,
severities, statuses) above the fold.

## Colors
Anchor on **primary violet `#7C3AED`** for brand + primary actions and `accent #8B5CF6`
for highlights. Keep the chrome neutral (background/surface/border/text tokens) so
**severity semantics dominate**: critical/high red, medium amber, low green, info blue.
Ship **light and dark** from day one — dark is the default for NOC/24-7 rooms; use the
`dark-*` tokens and honor the OS/user theme toggle. Status pills use tinted backgrounds
with the solid semantic color as the label.

## Typography
**Inter** for all UI (display → labels). **JetBrains Mono** for code, rule YAML, IDs
(rule_id, CASE-001, IPs, hashes), and technical metadata. Numeric/tabular data uses Inter
with tabular figures. Keep body at 14px for density.

## Layout
Deliberate, stable spacing on a 4px base; 16px gaps; 20px card padding. Consistent grid
direction and max-width; responsive stacking that never hides operator-critical columns
(severity, status, assignee) — collapse secondary columns first. Sidebar collapses to
icons on narrow viewports.

## Components
- **Sidebar nav** with Main/Manage groups; active item = primary-tinted fill + primary text.
- **Incident/Case cards** with a 3px left **severity rail**, title + status pill, metadata
  grid (detected time, severity, assignee), and tag pills.
- **Data tables** (Rules) — dense, sortable, sticky header, column chooser, filter, paging.
- **Monaco YAML editor** — dark canvas, split with a Details panel; inline schema lint.
- **Rule-type modal** — 6 typed cards (Query, Threshold, Source Monitor, Threat Match,
  Code, Spark) with icon + one-line description.
- **OpenUI chat** — generative-UI: agent replies render AlertCard, MitreMappingTable,
  InvestigationTimeline, RuleDiff (Apply), and **ApprovalPrompt** (Approve/Deny) inline.
- **Status/severity pills**, **integration connector cards** (Connected/Disconnected/Error).

## Motion
Restrained and functional: 150–200ms ease for hovers, pill/toggle states, and panel
transitions; streaming chat uses a subtle shimmer; live case/incident updates fade in.
No decorative WebGL in the app console — save ambient effects for the marketing page only.

## Guardrails
- Never let brand violet compete with severity color for attention in data views.
- Keep light **and** dark parity; every token has both roles.
- Preserve information density — do not flatten operator tables into card grids.
- Keep radius/border/label language consistent across cards, pills, inputs, and the editor.
- Monospace is reserved for code/IDs/technical values; do not set prose in mono.
