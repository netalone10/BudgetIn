"use client";

import { useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Collapsible wrapper for dashboard cards.
 * Persists collapsed state in localStorage per card ID.
 */

const STORAGE_KEY = "dashboard-collapsed-cards";

function getCollapsedState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCollapsedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently fail
  }
}

interface Props {
  cardId: string;
  title: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleCard({
  cardId,
  title,
  defaultCollapsed = false,
  children,
}: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    const stored = getCollapsedState();
    if (cardId in stored) return stored[cardId];
    return defaultCollapsed;
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      setCollapsedState({ ...getCollapsedState(), [cardId]: next });
      return next;
    });
  }, [cardId]);

  const contentId = `collapsible-${cardId}`;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="mb-2 flex w-full cursor-pointer items-center gap-1.5 rounded-md text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={!collapsed}
        aria-controls={contentId}
      >
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform",
            collapsed ? "-rotate-90" : "rotate-0"
          )}
        />
        {title}
      </button>
      <div
        id={contentId}
        role="region"
        className={cn(
          "overflow-hidden transition-all duration-200",
          collapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
        )}
      >
        {children}
      </div>
    </div>
  );
}
