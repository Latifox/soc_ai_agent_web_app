import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Sign out — clears the Supabase and/or dev session and returns to /login. */
export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 302 });
  response.cookies.set("aegis_dev_session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
