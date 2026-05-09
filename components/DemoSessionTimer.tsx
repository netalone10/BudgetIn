"use client";

import { Clock } from "lucide-react";
import { useDemoTimeout } from "@/lib/hooks/use-demo-timeout";

/**
 * Combined demo session timer + warning toast.
 * Shows countdown badge in header and a warning popup at 1 min remaining.
 */
export default function DemoSessionTimer() {
  const { secondsRemaining, showWarning } = useDemoTimeout();

  if (secondsRemaining === null) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <>
      {/* Warning toast when < 1 minute remaining */}
      {showWarning && (
        <div className="fixed top-4 right-4 z-50 bg-red-500/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-pulse">
          ⏱ Sesi demo berakhir dalam {display}
        </div>
      )}
      {/* Countdown badge — show in header */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
        <Clock className="size-3" />
        <span>{display}</span>
      </div>
    </>
  );
}
