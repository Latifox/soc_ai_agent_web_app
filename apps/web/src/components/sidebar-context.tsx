"use client";

import { useSyncExternalStore } from "react";

/**
 * Sidebar collapse is a small piece of client-only, persisted UI state shared
 * by the sidebar and header. Modeled as an external store + `useSyncExternalStore`
 * so it is SSR-safe (no hydration mismatch) without calling setState in an effect.
 * Narrow-viewport icon-rail behavior is handled in CSS by AppSidebar.
 */
const STORAGE_KEY = "aegis:sidebar-collapsed";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", emit);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", emit);
    }
  };
}

export function setSidebarCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* storage unavailable — ignore */
  }
  emit();
}

export function useSidebar() {
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return {
    collapsed,
    setCollapsed: setSidebarCollapsed,
    toggle: () => setSidebarCollapsed(!collapsed),
  };
}
