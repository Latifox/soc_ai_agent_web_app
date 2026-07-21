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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup") return signUp();
    return signInWithPassword();
  }

  async function signUp() {
    if (!SUPABASE_CONFIGURED) {
      return setError("Sign up needs Supabase — set NEXT_PUBLIC_SUPABASE_URL / ANON_KEY.");
    }
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` },
      });
      if (error) return setError(error.message);
      // Email-confirmation OFF → a session is returned immediately: go straight to onboarding.
      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
        return;
      }
      // Email-confirmation ON → no session yet.
      setNotice("Account created — check your inbox to confirm, then sign in.");
      setMode("signin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setPending(false);
    }
  }

  async function signInWithPassword() {
    setPending(true);
    setError(null);
    setNotice(null);
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
    <form onSubmit={submit} className="space-y-4">
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
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="••••••••"
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}
      {magicSent && <p className="text-sm text-emerald-600">Magic link sent — check your inbox.</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {pending ? (mode === "signup" ? "Creating account…" : "Signing in…") : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      {mode === "signin" ? (
        <button
          type="button"
          onClick={sendMagicLink}
          disabled={pending}
          className="w-full rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Email me a magic link
        </button>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        {mode === "signin" ? (
          <>New to Aegis?{" "}
            <button type="button" onClick={() => { setMode("signup"); setError(null); setNotice(null); }} className="font-medium text-violet-600 hover:underline">Create an account</button>
          </>
        ) : (
          <>Already have an account?{" "}
            <button type="button" onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className="font-medium text-violet-600 hover:underline">Sign in</button>
          </>
        )}
      </p>
      {!SUPABASE_CONFIGURED && (
        <p className="rounded-lg border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-xs text-muted-foreground">
          Local dev mode — sign in with <code className="font-mono">admin@demo.local</code> /{" "}
          <code className="font-mono">aegis-demo</code>. Configure Supabase for real accounts.
        </p>
      )}
    </form>
  );
}
