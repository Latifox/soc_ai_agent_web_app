import { NextResponse, type NextRequest } from "next/server";

/**
 * Switch the active workspace: store an onboarded tenant's access token in an httpOnly
 * cookie the BFF prefers over the default dev token. POST { token } to switch,
 * DELETE to return to the default tenant.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { token } = (await req.json()) as { token?: string };
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("aegis_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("aegis_token");
  return res;
}
