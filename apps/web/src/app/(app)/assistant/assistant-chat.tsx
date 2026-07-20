"use client";

import {
  AgentInterface,
  openAIAdapter,
  openAIMessageFormat,
  type ChatLLM,
} from "@openuidev/react-ui";

import { aegisLibrary } from "@/lib/genui/aegis-library";

export function AssistantChat() {
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
    <div className="soc-panel h-[calc(100vh-10.75rem)] min-h-[560px] overflow-hidden">
      <AgentInterface
        llm={llm}
        componentLibrary={aegisLibrary}
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
