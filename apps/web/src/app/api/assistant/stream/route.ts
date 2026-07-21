import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Assistant stream proxy: browser -> here -> FastAPI /api/v1/assistant/stream (Argus
 * crew via ArgusService). Injects the caller's tenant JWT so the crew + tools enforce
 * isolation; the browser never holds backend credentials. Relays SSE.
 * See docs/09-chat-generative-ui.md.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.AEGIS_API_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  // Verified Supabase session; the access token carries the tenant_id claim that
  // AgentOS + MCP tools enforce downstream.
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const token = session.access_token;
  const body = await req.text();

  const upstream = await fetch(`${API_URL}/api/v1/assistant/stream`, {
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
