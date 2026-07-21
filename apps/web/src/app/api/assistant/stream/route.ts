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

async function bearer(req: NextRequest): Promise<string | null> {
  const cookieToken = req.cookies.get("aegis_token")?.value;
  if (cookieToken) return cookieToken;
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return session.access_token;
    }
  } catch {
    // Supabase not configured — fall through to the dev token.
  }
  return process.env.AEGIS_DEV_TOKEN ?? null;
}

export async function POST(req: NextRequest) {
  // Verified session token (Supabase in prod, AEGIS_DEV_TOKEN in local dev). The
  // tenant_id claim is enforced downstream by the crew + tools.
  const token = await bearer(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
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
