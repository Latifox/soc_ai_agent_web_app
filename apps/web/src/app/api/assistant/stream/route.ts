import type { NextRequest } from "next/server";

/**
 * BFF stream proxy: browser -> here -> AgentOS (Argus). Injects the caller's tenant
 * JWT so AgentOS + MCP tools enforce isolation; the browser never talks to AgentOS
 * directly with secrets. Streams OpenUI Lang tokens back as SSE.
 * See docs/09-chat-generative-ui.md.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENTOS_URL = process.env.AGENTOS_URL ?? "http://localhost:7777";

export async function POST(req: NextRequest) {
  // FE-02 replaces this with the @supabase/ssr server client to read the verified
  // session; the access token carries the tenant_id claim used downstream.
  const token = req.cookies.get("sb-access-token")?.value ?? "";
  const body = await req.text();

  const upstream = await fetch(`${AGENTOS_URL}/runs?stream=true`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body,
  });

  if (!upstream.body) {
    return new Response(JSON.stringify({ error: "no stream from AgentOS" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
