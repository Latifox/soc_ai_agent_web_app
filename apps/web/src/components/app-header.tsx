"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CircleHelp,
  Command,
  PanelLeft,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSidebar } from "@/components/sidebar-context";
import { allNavItems } from "@/lib/nav";

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { toggle } = useSidebar();
  const pageLabel = pathname.split("/").filter(Boolean).at(-1) ?? "dashboard";
  const [query, setQuery] = React.useState("");
  const [panel, setPanel] = React.useState<"help" | "notifications" | null>(null);
  const matches = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return allNavItems.slice(0, 5);
    return allNavItems.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(normalized)).slice(0, 5);
  }, [query]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = matches[0];
    if (target) {
      router.push(target.href);
      setQuery("");
    } else if (query.trim()) {
      router.push(`/investigations?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/92 px-3 backdrop-blur-xl sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle sidebar"
        onClick={toggle}
      >
        <PanelLeft aria-hidden="true" />
      </Button>

      <form onSubmit={submitSearch} className="relative mx-auto min-w-0 max-w-xl flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Search Aegis"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setPanel(null)}
          placeholder={`Search ${pageLabel}, incidents, IPs, hashes...`}
          className="h-9 w-full rounded-control border border-border bg-surface-subtle pl-9 pr-16 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
          <Command className="size-3" aria-hidden="true" />K
        </span>
        {query ? (
          <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-card border border-border bg-popover shadow-xl">
            {matches.length ? matches.map((item) => (
              <button key={item.href} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { router.push(item.href); setQuery(""); }} className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-muted">
                <item.icon className="mt-0.5 size-4 text-primary" />
                <span className="min-w-0"><span className="block text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.description}</span></span>
              </button>
            )) : <button type="submit" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">Search investigations for {query}</button>}
          </div>
        ) : null}
      </form>

      <div className="ml-auto flex items-center gap-1">
        <div className="mr-2 hidden items-center gap-2 text-xs lg:flex">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-low opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-low" />
          </span>
          <span className="text-muted-foreground">Systems operational</span>
        </div>
        <div className="relative hidden sm:block">
        <Button variant="ghost" size="icon" aria-label="Open help" className="hidden sm:inline-flex" onClick={() => setPanel((value) => value === "help" ? null : "help")}>
          <CircleHelp aria-hidden="true" />
        </Button>
          {panel === "help" ? (
            <div className="absolute right-0 top-11 z-30 w-72 rounded-card border border-border bg-popover p-3 shadow-xl">
              <p className="text-sm font-semibold">Aegis help</p>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                <button type="button" onClick={() => router.push("/assistant?context=Help")} className="rounded-control border border-border px-3 py-2 text-left hover:bg-muted">Ask Argus about this page</button>
                <button type="button" onClick={() => router.push("/reports")} className="rounded-control border border-border px-3 py-2 text-left hover:bg-muted">Open operational reports</button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="relative">
        <Button variant="ghost" size="icon" aria-label="Open notifications" className="relative" onClick={() => setPanel((value) => value === "notifications" ? null : "notifications")}>
          <Bell aria-hidden="true" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary ring-2 ring-background" />
        </Button>
          {panel === "notifications" ? (
            <div className="absolute right-0 top-11 z-30 w-80 rounded-card border border-border bg-popover shadow-xl">
              {["Containment approval required", "Okta connector delayed", "Weekly SOC report ready"].map((item) => (
                <button key={item} type="button" onClick={() => router.push(item.includes("report") ? "/reports" : "/dashboard")} className="block w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted">
                  <span className="block text-sm font-medium">{item}</span>
                  <span className="block text-xs text-muted-foreground">Open related workspace</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <ThemeToggle />
        <Link
          href="/settings"
          className="ml-1 hidden items-center gap-2 border-l border-border pl-3 sm:flex"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/12 text-primary">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          <span className="hidden leading-tight xl:block">
            <span className="block text-xs font-semibold">Priya N.</span>
            <span className="block text-[10px] text-muted-foreground">Tier 2 Analyst</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
