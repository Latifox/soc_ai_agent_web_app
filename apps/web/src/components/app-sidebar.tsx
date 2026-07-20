"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, ShieldCheck } from "lucide-react";

import { navGroups } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/sidebar-context";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  // Below `lg` the sidebar is always an icon rail. At `lg`+ it follows the
  // persisted `collapsed` preference. `label` hides text accordingly.
  const label = collapsed ? "hidden" : "hidden lg:inline";
  const rowAlign = collapsed
    ? "justify-center px-0"
    : "justify-center px-0 lg:justify-start lg:px-2.5";

  return (
    <aside
      aria-label="Primary"
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 z-30 flex h-screen w-16 shrink-0 flex-col border-r border-border bg-muted transition-[width] duration-200 ease-out",
        collapsed ? "lg:w-16" : "lg:w-64",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-border",
          collapsed
            ? "justify-center px-0"
            : "justify-center px-0 lg:justify-start lg:px-3",
        )}
      >
        <Link
          href="/dashboard"
          aria-label="Aegis — Dashboard"
          className="flex items-center gap-2.5 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <span
            className={cn(
              "text-lg font-bold tracking-tight text-foreground",
              label,
            )}
          >
            Aegis
          </span>
        </Link>
      </div>

      {/* Grouped nav */}
      <nav
        aria-label="Primary navigation"
        className="flex-1 overflow-y-auto px-2 py-3"
      >
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p
              className={cn(
                "px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70",
                collapsed ? "sr-only" : "sr-only lg:not-sr-only",
              )}
            >
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={item.title}
                      className={cn(
                        "group flex items-center gap-3 rounded-control py-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                        rowAlign,
                        active
                          ? "bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-primary"
                          : "text-muted-foreground hover:bg-[color-mix(in_srgb,var(--color-foreground)_5%,transparent)] hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                        aria-hidden="true"
                      />
                      <span className={cn("truncate", label)}>
                        {item.title}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Account switcher */}
      <div className="border-t border-border p-2">
        <button
          type="button"
          aria-label="Switch account or organization"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-control p-1.5 text-left outline-none transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-foreground)_5%,transparent)] focus-visible:ring-2 focus-visible:ring-ring",
            collapsed ? "justify-center" : "justify-center lg:justify-start",
          )}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-control bg-accent/15 text-xs font-semibold text-accent"
            aria-hidden="true"
          >
            SG
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 flex-col",
              collapsed ? "hidden" : "hidden lg:flex",
            )}
          >
            <span className="truncate text-sm font-medium text-foreground">
              Sekera Group
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              admin@sekera-group.com
            </span>
          </span>
          <ChevronsUpDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground",
              collapsed ? "hidden" : "hidden lg:block",
            )}
            aria-hidden="true"
          />
        </button>
      </div>
    </aside>
  );
}
