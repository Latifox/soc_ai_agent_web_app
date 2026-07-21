"use client";

import { useRouter } from "next/navigation";

import { OnboardingWizard } from "@/features/workspaces/onboarding-wizard";

/**
 * First-run onboarding — shown right after sign up (or when a signed-in user has no
 * connected workspace yet). Bootstraps the user's first tenant and its OpenSearch source,
 * then drops them into the dashboard.
 */
export default function OnboardingPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Welcome to Aegis</h1>
          <p className="text-sm text-muted-foreground">
            Set up your workspace and connect your OpenSearch cluster to start ingesting and detecting.
          </p>
        </div>
      </div>
      <OnboardingWizard
        firstRun
        onClose={() => {
          router.replace("/dashboard");
          router.refresh();
        }}
      />
    </main>
  );
}
