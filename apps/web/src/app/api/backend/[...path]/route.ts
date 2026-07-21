import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Authenticated proxy for client-side mutations: browser -> here -> FastAPI BFF.
 * Injects the verified Supabase access token (tenant_id claim); the browser never
 * holds backend credentials.
 */

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

async function proxy(req: NextRequest, path: string[]) {
  const token = await bearer(req);
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(`${API_URL}/api/v1/${path.join("/")}`);
  url.search = req.nextUrl.search;

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const upstream = await fetch(url, {
    method: req.method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
