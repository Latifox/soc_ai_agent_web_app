"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

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
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (error) return setError(error.message);
    router.replace(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  async function sendMagicLink() {
    if (!email) return setError("Enter your email first.");
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setPending(false);
    if (error) return setError(error.message);
    setMagicSent(true);
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
    </form>
  );
}
