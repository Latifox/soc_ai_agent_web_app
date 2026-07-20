import type { ReactNode } from "react";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <AppHeader />
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
