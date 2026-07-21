"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (!SUPABASE_CONFIGURED) {
        // Dev mode: server-validated credentials + httpOnly session cookie.
        const resp = await fetch("/api/auth/dev-login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!resp.ok) {
          const data = (await resp.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Invalid email or password");
          return;
        }
      } else {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
          return;
        }
      }
      router.replace(params.get("next") ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setPending(false);
    }
  }

  async function sendMagicLink() {
    if (!email) return setError("Enter your email first.");
    if (!SUPABASE_CONFIGURED) {
      return setError("Magic links need Supabase — run `supabase start` and set NEXT_PUBLIC_SUPABASE_*.");
    }
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) return setError(error.message);
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={signInWithPassword} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="you@company.com"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="••••••••"
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {magicSent && <p className="text-sm text-emerald-600">Magic link sent — check your inbox.</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <button
        type="button"
        onClick={sendMagicLink}
        disabled={pending}
        className="w-full rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        Email me a magic link
      </button>
      {!SUPABASE_CONFIGURED && (
        <p className="rounded-lg border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-xs text-muted-foreground">
          Local dev mode — sign in with <code className="font-mono">admin@demo.local</code> /{" "}
          <code className="font-mono">aegis-demo</code>. Configure Supabase for real accounts.
        </p>
      )}
    </form>
  );
}
