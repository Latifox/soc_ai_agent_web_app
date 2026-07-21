import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — Aegis" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-violet-600 text-white">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <div className="text-lg font-semibold leading-tight">Aegis</div>
            <div className="text-xs text-muted-foreground">Autonomous AI SOC</div>
          </div>
        </div>
        <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Use your organization account to access the SOC console.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
