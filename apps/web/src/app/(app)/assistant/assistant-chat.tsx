"use client";

import { useEffect, useRef } from "react";
import {
  AgentInterface,
  openAIAdapter,
  openAIMessageFormat,
  type ChatLLM,
} from "@openuidev/react-ui";
import "@openuidev/react-ui/index.css";
import "@openuidev/react-ui/components.css";

import { aegisLibrary } from "@/lib/genui/aegis-library";

// Render assistant replies as prose. Overriding AssistantMessage bypasses OpenUI's
// GenUI-Lang parser (which rejects plain text with "no renderable root component").
function AssistantMessageView({
  message,
}: {
  message: { content?: string | null };
  isStreaming: boolean;
}) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
      {message.content ?? ""}
    </div>
  );
}

export function AssistantChat() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Focus the composer on mount so the analyst can type immediately (no tabbing
  // through the whole nav to reach the input).
  useEffect(() => {
    const focusComposer = () => {
      const input = rootRef.current?.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder="Type your query here"], textarea',
      );
      input?.focus();
      return Boolean(input);
    };
    if (focusComposer()) return;
    const timer = window.setTimeout(focusComposer, 400);
    return () => window.clearTimeout(timer);
  }, []);

  const llm: ChatLLM = {
    send: ({ messages, signal }) =>
      fetch("/api/assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: openAIMessageFormat.toApi(messages) }),
        signal,
      }),
    streamProtocol: openAIAdapter(),
  };

  return (
    <div ref={rootRef} className="soc-panel flex h-[calc(100dvh-12.5rem)] min-h-[380px] flex-col overflow-hidden">
      <AgentInterface
        llm={llm}
        componentLibrary={aegisLibrary}
        components={{ AssistantMessage: AssistantMessageView }}
        agentName="Argus"
        theme={{ mode: "dark" }}
        starters={[
          {
            displayText: "Investigate a critical incident",
            prompt: "Investigate INC-2026-0720-0001 and show the attack path.",
          },
          {
            displayText: "Draft a detection",
            prompt: "Draft a rule for suspicious LSASS memory access.",
          },
          {
            displayText: "Review pending actions",
            prompt: "Show response actions waiting for approval.",
          },
        ]}
      />
    </div>
  );
}
