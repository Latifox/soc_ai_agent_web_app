# 09 — Chat & Generative UI (OpenUI)

The Aegis chat / global **AI Assistant** is built on **OpenUI — the Open Standard for
Generative UI** (thesysdev). Instead of the agent replying with plain markdown, it
replies with *our* UI: the model emits a compact, streaming description of a UI composed
only from **registered security components**, and OpenUI renders it live in React.

- Site: https://www.openui.com/ · Docs: https://www.openui.com/docs · GitHub: https://github.com/thesysdev/openui
- Scaffold: `pnpx @openuidev/cli@latest create --name aegis-chat` (also `npx` / `bunx` / `yarn dlx`).

## 1. Why generative UI (not plain chat)

A SOC chat that only returns text wastes the interface. With OpenUI the Argus crew can
return an **Alert Card**, a **MITRE ATT&CK table**, an **Investigation Timeline**, a
**Rule Diff** with an *Apply* button, or an **Approval prompt** with *Approve/Deny*
buttons — as first-class, interactive UI, streamed token-by-token. OpenUI claims ~3x
faster rendering and ~67% fewer tokens than JSON-based UI generation because the model
writes **OpenUI Lang** (a token-efficient, line-oriented format) rather than verbose JSON.

Key properties:
- **Streaming-first** — UI paints progressively as the response arrives.
- **Safe by default** — the model can only compose components we registered (no arbitrary
  HTML/JS injection). Critical for a security product.
- **Live data** — components can query tools / MCP servers at runtime.

## 2. How OpenUI works (4 steps)

1. **Define components** with `defineComponent` + `createLibrary` (props typed with Zod).
2. **Generate a system prompt** (or JSON schema) from the library and send it to the LLM.
3. **LLM responds in OpenUI Lang** — token-efficient, line-oriented UI description.
4. **Renderer parses + renders** the UI into React in real time.

## 3. Packages

| Package | Role |
|---------|------|
| `@openuidev/cli` | Scaffold a chat app; generate system prompts / JSON schemas from a library |
| `@openuidev/react-lang` | Core runtime: define component libraries (Zod), generate prompts, render streamed OpenUI Lang → React |
| `@openuidev/react-headless` | Headless chat state: `ChatProvider`, thread/message hooks, **streaming protocol adapters** |
| `@openuidev/react-ui` | Prebuilt chat layouts + ready-made component libraries (shadcn-style) |

## 4. Aegis component library (security-domain components)

We register a domain library so the agent speaks in SOC UI, not generic widgets:

```ts
// components/aegis-genui-library.ts
import { defineComponent, createLibrary } from "@openuidev/react-lang";
import { z } from "zod";

const AlertCard = defineComponent({
  name: "AlertCard",
  description: "A security alert summary with severity, host, user, and status.",
  props: z.object({
    title: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    host: z.string().optional(),
    user: z.string().optional(),
    detectedAt: z.string(),
    status: z.enum(["open", "in_progress", "resolved"]),
  }),
  render: (p) => <AlertCardView {...p} />,
});

const MitreMappingTable = defineComponent({
  name: "MitreMappingTable",
  description: "Table mapping observed activity to MITRE ATT&CK tactics/techniques.",
  props: z.object({
    rows: z.array(z.object({
      tactic: z.string(), technique: z.string(), id: z.string(), evidence: z.string(),
    })),
  }),
  render: (p) => <MitreTableView {...p} />,
});

const InvestigationTimeline = defineComponent({
  name: "InvestigationTimeline",
  description: "Chronological events of an incident with host/user/action.",
  props: z.object({
    events: z.array(z.object({ ts: z.string(), actor: z.string(), action: z.string() })),
  }),
  render: (p) => <TimelineView {...p} />,
});

const RuleDiff = defineComponent({
  name: "RuleDiff",
  description: "Proposed detection rule YAML with an Apply action (Vibe Detection).",
  props: z.object({ ruleId: z.string().optional(), yaml: z.string() }),
  render: (p) => <RuleDiffView {...p} />,   // Apply → POST /rules (backtest first)
});

const ApprovalPrompt = defineComponent({
  name: "ApprovalPrompt",
  description: "Approve/deny a destructive SOAR action pending HITL confirmation.",
  props: z.object({
    runId: z.string(), toolName: z.string(),
    args: z.record(z.any()), risk: z.enum(["low","medium","high"]),
  }),
  render: (p) => <ApprovalPromptView {...p} />,  // Approve → confirm; Deny → reject
});

export const aegisLibrary = createLibrary({
  components: [AlertCard, MitreMappingTable, InvestigationTimeline, RuleDiff, ApprovalPrompt,
               /* EntityCard, MetricTile, CaseCard, EnrichmentCard, … */],
});
```

The library's system prompt is generated (via CLI or `react-lang`) and injected into the
Argus team's instructions so the model knows exactly which components exist and their
prop schemas.

## 5. Binding OpenUI to the Agno AgentOS backend

OpenUI is framework-agnostic (works with any streaming LLM/agent backend via **streaming
protocol adapters** in `react-headless`). Aegis wires it to **Agno AgentOS**:

```
┌──────────────────────────────┐        stream (SSE/WS)        ┌───────────────────────────┐
│  Next.js frontend            │  ◄──────────────────────────  │  Agno AgentOS (FastAPI)   │
│  @openuidev/react-ui +       │   OpenUI Lang tokens          │  Argus team + workflows   │
│  react-headless ChatProvider │  ──────────────────────────►  │  :7777, /run, /approvals  │
│  renders aegisLibrary        │        user messages          │  Claude models + MCP tools│
└──────────────────────────────┘                               └───────────────────────────┘
```

- The Argus team's model is instructed (via the generated system prompt) to answer in
  OpenUI Lang using `aegisLibrary` components.
- A thin **adapter** maps AgentOS streaming run events → the OpenUI streaming protocol the
  `ChatProvider` consumes. Tool-call and reasoning events render as OpenUI's built-in
  tool-call/reasoning views; final content renders as our components.
- **HITL loop:** when a run pauses on a `requires_confirmation` tool (e.g.
  `soar_isolate_host`), the backend emits an `ApprovalPrompt`; the analyst clicks
  Approve/Deny; the frontend calls the AgentOS **approvals** endpoint →
  `continue_run(requirements=…)`. See [03-agents §6.2](03-agents.md).

```tsx
// app/(app)/assistant/page.tsx
import { ChatProvider, Thread, Composer } from "@openuidev/react-ui";
import { aegisLibrary } from "@/components/aegis-genui-library";

export default function Assistant() {
  return (
    <ChatProvider
      library={aegisLibrary}
      endpoint="/api/assistant/stream"    // BFF proxy → AgentOS :7777 (adds tenant JWT)
      streaming
    >
      <Thread />       {/* renders AlertCard / MitreMappingTable / ApprovalPrompt … */}
      <Composer placeholder="Ask about an alert, rule, or incident…" />
    </ChatProvider>
  );
}
```

## 6. Where generative UI appears in Aegis

- **Global AI Assistant** (nav item) — "explain this alert", "why did this fire", "draft a
  rule for X" → renders AlertCard + MITRE table + RuleDiff.
- **In-incident copilot** — side panel on a case; the agent streams timeline + narrative.
- **Vibe Detection** (rule editor Assistant tab) — NL → `RuleDiff` with Apply → backtest.
- **Approvals** — destructive SOAR actions surface as `ApprovalPrompt` inline in chat.

## 7. Multi-tenancy & safety in the chat

- The chat `endpoint` is a **BFF proxy** that injects the caller's tenant JWT; AgentOS +
  MCP tools enforce tenant scope (RLS / row policies / DLS). The browser never talks to
  AgentOS directly with tenant secrets.
- OpenUI's "safe by default" (only registered components) prevents rendered-content
  injection — important since chat context includes untrusted log data. Combined with the
  `PromptInjectionGuardrail` on the Argus team (see [03-agents §6.3](03-agents.md)).

## 8. Scaffolding steps

```bash
# 1. scaffold the OpenUI chat app (or add packages to the existing Next.js app)
pnpx @openuidev/cli@latest create --name aegis-chat

# 2. add the runtime packages if integrating into the main app
pnpm add @openuidev/react-lang @openuidev/react-headless @openuidev/react-ui zod

# 3. define aegisLibrary (section 4), generate the system prompt via CLI:
pnpx @openuidev/cli@latest gen-prompt --library components/aegis-genui-library.ts

# 4. inject that prompt into the Argus team instructions (backend, see 03-agents)
# 5. point ChatProvider.endpoint at the BFF proxy to AgentOS
```
