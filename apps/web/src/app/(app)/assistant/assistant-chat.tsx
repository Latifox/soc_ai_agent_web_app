"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  AgentInterface,
  openAIAdapter,
  openAIMessageFormat,
  type ChatLLM,
} from "@openuidev/react-ui";
import { Renderer } from "@openuidev/react-lang";
import "@openuidev/react-ui/index.css";
import "@openuidev/react-ui/components.css";
import { Sparkles } from "lucide-react";

import { aegisLibrary } from "@/lib/genui/aegis-library";

export interface ArgusContext {
  kind: "incident" | "case";
  id: string;
  title: string;
  summary: string;
  entities: string[];
  lang: string; // OpenUI Lang for the generative-UI context card
}

function stripFences(s: string): string {
  return s.replace(/```(?:openui|ya?ml|lang)?\s*/gi, "").replace(/```/g, "").trim();
}
// A reply is generative UI when it's an OpenUI Lang program (has a `root = …` line).
function looksLikeLang(s: string): boolean {
  return /(^|\n)\s*root\s*=/.test(stripFences(s));
}

// Hybrid renderer: OpenUI Lang replies render as generative UI (cards/tables/timelines
// via the Aegis component library); everything else renders as prose.
function AssistantMessageView({ message, isStreaming }: { message: { content?: string | null }; isStreaming: boolean }) {
  const content = message.content ?? "";
  if (looksLikeLang(content)) {
    return (
      <div className="space-y-2">
        <Renderer response={stripFences(content)} library={aegisLibrary} isStreaming={isStreaming} />
      </div>
    );
  }
  return <div className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{content}</div>;
}

const STARTERS = [
  { displayText: "Investigate & map MITRE", prompt: "Investigate this and map the activity to MITRE ATT&CK." },
  { displayText: "Explain the attack path", prompt: "Summarize the attack path and blast radius." },
  { displayText: "Recommend response", prompt: "Recommend concrete response actions, noting which need approval." },
];

async function persistTurn(threadId: string, context: ArgusContext | undefined, apiMessages: { role: string; content: unknown }[], assistant: string) {
  const title = context ? `${context.kind === "incident" ? "Incident" : "Case"}: ${context.title}` : String(apiMessages.find((m) => m.role === "user")?.content ?? "Investigation").slice(0, 60);
  const messages = [...apiMessages.map((m) => ({ role: m.role, content: m.content })), { role: "assistant", content: assistant }];
  try {
    await fetch("/api/backend/assistant/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: threadId, title, context: context ? { kind: context.kind, id: context.id, title: context.title } : null, messages }),
    });
  } catch {
    /* persistence is best-effort */
  }
}

export function AssistantChat({ context, onSaved }: { context?: ArgusContext; onSaved?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const threadId = useMemo(() => (context ? `${context.kind}-${context.id}` : (globalThis.crypto?.randomUUID?.() ?? String(Date.now()))), [context]);

  useEffect(() => {
    const focus = () => {
      const input = rootRef.current?.querySelector<HTMLTextAreaElement>('textarea[placeholder="Type your query here"], textarea');
      input?.focus();
      return Boolean(input);
    };
    if (focus()) return;
    const t = window.setTimeout(focus, 400);
    return () => window.clearTimeout(t);
  }, []);

  const llm: ChatLLM = {
    send: async ({ messages, signal }) => {
      const apiMessages = openAIMessageFormat.toApi(messages) as { role: string; content: unknown }[];
      const resp = await fetch("/api/assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, context: context ? { kind: context.kind, title: context.title, summary: context.summary, entities: context.entities } : undefined }),
        signal,
      });
      // Tee the stream: one copy feeds the UI, the other accumulates the reply to persist.
      if (resp.body) {
        const [toUi, toSave] = resp.body.tee();
        void (async () => {
          const reader = toSave.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let text = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            for (const line of buf.split("\n")) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const payload = t.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const c = JSON.parse(payload)?.choices?.[0]?.delta?.content;
                if (typeof c === "string") text += c;
              } catch {
                /* partial frame */
              }
            }
            buf = buf.slice(buf.lastIndexOf("\n") + 1);
          }
          if (text.trim()) { await persistTurn(threadId, context, apiMessages, text); onSaved?.(); }
        })();
        return new Response(toUi, { status: resp.status, headers: resp.headers });
      }
      return resp;
    },
    streamProtocol: openAIAdapter(),
  };

  return (
    <div ref={rootRef} className="soc-panel flex h-full min-h-[380px] flex-col overflow-hidden">
      {context ? (
        <div className="border-b border-border bg-surface-subtle/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary"><Sparkles className="size-3.5" /> Investigating {context.kind}: {context.title}</div>
          <Renderer response={context.lang} library={aegisLibrary} />
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <AgentInterface
          llm={llm}
          componentLibrary={aegisLibrary}
          components={{ AssistantMessage: AssistantMessageView }}
          agentName="Argus"
          theme={{ mode: "dark" }}
          starters={STARTERS}
        />
      </div>
    </div>
  );
}
