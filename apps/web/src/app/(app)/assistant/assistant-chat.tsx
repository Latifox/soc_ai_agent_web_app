"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Renderer } from "@openuidev/react-lang";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";

import { aegisLibrary } from "@/lib/genui/aegis-library";
import { cn } from "@/lib/utils";

export interface ArgusContext {
  kind: "incident" | "case";
  id: string;
  title: string;
  summary: string;
  entities: string[];
  lang: string; // OpenUI Lang for the generative-UI context card
}

type Msg = { role: "user" | "assistant"; content: string };

function stripFences(s: string): string {
  return s.replace(/```(?:openui|ya?ml|lang)?\s*/gi, "").replace(/```/g, "").trim();
}
// Extract the OpenUI Lang program from a reply. The assistant always answers in Lang, but weaker
// models sometimes leak leading prose/tool-JSON before `root = …` — strip everything before the
// first `root =` line so the program parses cleanly. Returns "" when there's no program yet.
function extractLang(s: string): string {
  const stripped = stripFences(s);
  // `root =` normally starts a line, but weaker models can glue it right after a leaked tool-JSON
  // blob (…None}root = Stack). Match at a line start OR after a leading `}`/`]`/quote/space so the
  // program is still recovered; `root\s*=` almost never appears in prose.
  const m = /(^|\n|[}\]"'\s])(root[ \t]*=)/.exec(stripped);
  return m ? stripped.slice(m.index + m[1].length).replace(/^\n/, "") : "";
}

// The assistant replies in OpenUI Lang → render as generative UI. While streaming, before the
// `root =` line has arrived, show a lightweight building state instead of raw partial text.
function AssistantBody({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const lang = extractLang(content);
  if (lang) {
    return <Renderer response={lang} library={aegisLibrary} isStreaming={isStreaming} onError={() => {}} />;
  }
  if (isStreaming) {
    return <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Building…</span>;
  }
  // Fallback: a model that ignored the contract and replied in prose.
  return <div className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{stripFences(content)}</div>;
}

const STARTERS = [
  { label: "Investigate & map MITRE", prompt: "Investigate this and map the activity to MITRE ATT&CK." },
  { label: "Explain the attack path", prompt: "Summarize the attack path and blast radius." },
  { label: "Recommend response", prompt: "Recommend concrete response actions, noting which need approval." },
];

async function persistTurn(threadId: string, context: ArgusContext | undefined, messages: Msg[]) {
  const firstUser = messages.find((m) => m.role === "user")?.content ?? "Investigation";
  const title = context ? `${context.kind === "incident" ? "Incident" : "Case"}: ${context.title}` : String(firstUser).slice(0, 60);
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

export function AssistantChat({ context, onSaved, initialMessages, threadKey }: { context?: ArgusContext; onSaved?: () => void; initialMessages?: Msg[]; threadKey?: string }) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages ?? []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // A loaded thread keeps its stored id so replies update the same Supabase thread.
  const threadId = useMemo(() => threadKey ?? (context ? `${context.kind}-${context.id}` : (globalThis.crypto?.randomUUID?.() ?? String(Date.now()))), [threadKey, context]);

  useEffect(() => { taRef.current?.focus(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      const history: Msg[] = [...messages, { role: "user", content: q }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setInput("");
      setBusy(true);
      let acc = "";
      try {
        const resp = await fetch("/api/assistant/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            context: context ? { kind: context.kind, title: context.title, summary: context.summary, entities: context.entities } : undefined,
          }),
        });
        if (!resp.body) throw new Error(String(resp.status));
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const c = JSON.parse(payload)?.choices?.[0]?.delta?.content;
              if (typeof c === "string") {
                acc += c;
                setMessages((m) => { const cp = [...m]; cp[cp.length - 1] = { role: "assistant", content: acc }; return cp; });
              }
            } catch {
              /* partial frame */
            }
          }
        }
      } catch {
        acc = acc || "⚠️ Argus is unavailable right now. Check the API is running.";
        setMessages((m) => { const cp = [...m]; cp[cp.length - 1] = { role: "assistant", content: acc }; return cp; });
      } finally {
        setBusy(false);
        if (acc.trim()) { await persistTurn(threadId, context, [...history, { role: "assistant", content: acc }]); onSaved?.(); }
      }
    },
    [messages, busy, context, threadId, onSaved],
  );

  // Generative-UI actions: SuggestChips send a prompt; RuleCard "Deploy" pushes the rule to
  // OpenSearch as a live monitor, then reports the result back into the thread.
  useEffect(() => {
    const onSuggest = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) void send(prompt);
    };
    const onDeploy = async (e: Event) => {
      const d = (e as CustomEvent<{ yaml?: string; title?: string }>).detail;
      if (!d?.yaml) return;
      setMessages((m) => [...m, { role: "assistant", content: `Deploying **${d.title ?? "rule"}** to OpenSearch…` }]);
      try {
        const r = await fetch("/api/backend/rules/deploy-yaml", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ yaml: d.yaml, title: d.title }),
        });
        const j = await r.json().catch(() => ({}));
        const ok = r.ok && j?.deployed;
        setMessages((m) => { const cp = [...m]; cp[cp.length - 1] = { role: "assistant", content: ok ? `✅ Deployed **${j.name}** as OpenSearch monitor \`${j.monitor_id}\`. It’s now live on the Rules page.` : `⚠️ Deploy failed: ${j?.detail ?? j?.title ?? r.status}` }; return cp; });
      } catch {
        setMessages((m) => { const cp = [...m]; cp[cp.length - 1] = { role: "assistant", content: "⚠️ Deploy failed — API unreachable." }; return cp; });
      }
    };
    window.addEventListener("aegis:suggest", onSuggest);
    window.addEventListener("aegis:deploy-rule", onDeploy);
    return () => { window.removeEventListener("aegis:suggest", onSuggest); window.removeEventListener("aegis:deploy-rule", onDeploy); };
  }, [send]);

  const empty = messages.length === 0;

  return (
    <div className="soc-panel flex h-full min-h-[380px] flex-col overflow-hidden">
      {/* Context card (generative UI of the incident/case being investigated) */}
      {context ? (
        <div className="border-b border-border bg-surface-subtle/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary"><Sparkles className="size-3.5" /> Investigating {context.kind}: {context.title}</div>
          <Renderer response={context.lang} library={aegisLibrary} onError={() => {}} />
        </div>
      ) : null}

      {/* Message list */}
      <div ref={scrollRef} className="soc-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {empty ? (
          <div className="mx-auto mt-10 max-w-md text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="size-6" /></span>
            <p className="mt-3 text-sm font-semibold">Ask Argus</p>
            <p className="mt-1 text-xs text-muted-foreground">Tenant-scoped autonomous SOC. Investigate incidents, query OpenSearch, map MITRE, draft rules — replies render as live generative UI.</p>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" ? (
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-3.5" /></span>
            ) : null}
            <div className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5",
              m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-surface-subtle/40",
            )}>
              {m.role === "assistant" ? (
                m.content ? <AssistantBody content={m.content} isStreaming={busy && i === messages.length - 1} />
                  : <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Thinking…</span>
              ) : (
                <div className="whitespace-pre-wrap break-words text-sm leading-6">{m.content}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        {empty ? (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {STARTERS.map((s) => (
              <button key={s.label} type="button" onClick={() => send(s.prompt)} disabled={busy}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50">
                <Sparkles className="mr-1 inline size-3 text-primary" /> {s.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-card border border-border bg-background p-2 focus-within:border-primary/50">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            rows={1}
            placeholder="Ask Argus to investigate, query logs, or draft a rule…"
            className="soc-scrollbar max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button type="button" onClick={() => void send(input)} disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
