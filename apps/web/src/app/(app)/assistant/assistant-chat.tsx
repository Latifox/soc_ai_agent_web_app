"use client";

/**
 * OpenUI generative-UI chat, bound to the Argus crew via the BFF stream proxy.
 * Agent replies render as Aegis components (AlertCard, MitreMappingTable, RuleDiff,
 * ApprovalPrompt, …) streamed live. See docs/09-chat-generative-ui.md.
 */

import { ChatProvider, Composer, Thread } from "@openuidev/react-ui";

import { aegisLibrary } from "@/lib/genui/aegis-library";

export function AssistantChat() {
  return (
    <ChatProvider library={aegisLibrary} endpoint="/api/assistant/stream" streaming>
      <div className="flex h-[calc(100vh-11rem)] flex-col rounded-xl border">
        <Thread className="flex-1 overflow-y-auto p-4" />
        <div className="border-t p-3">
          <Composer placeholder="Ask about an alert, rule, or incident…" />
        </div>
      </div>
    </ChatProvider>
  );
}
