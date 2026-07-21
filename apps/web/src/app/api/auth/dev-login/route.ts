import { NextResponse, type NextRequest } from "next/server";

/**
 * Dev authentication (active only when Supabase is not configured).
 * Validates credentials server-side and sets an httpOnly session cookie that the
 * middleware checks. Replaced entirely by Supabase Auth once
 * NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are set.
 */

const DEV_SESSION_COOKIE = "aegis_dev_session";

const DEV_EMAIL = process.env.AEGIS_DEV_EMAIL ?? "admin@demo.local";
const DEV_PASSWORD = process.env.AEGIS_DEV_PASSWORD ?? "aegis-demo";

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function POST(req: NextRequest) {
  if (supabaseConfigured()) {
    return NextResponse.json({ error: "dev login disabled — use Supabase Auth" }, { status: 403 });
  }
  const { email, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  if (email !== DEV_EMAIL || password !== DEV_PASSWORD) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEV_SESSION_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEV_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
