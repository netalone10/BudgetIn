"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { signOut } from "next-auth/react";
import { useIsDemo } from "@/lib/hooks/use-is-demo";

const TIMEOUT_MINUTES = 15;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;
const WARNING_MS = 60 * 1000; // warn at 1 minute remaining

/**
 * Demo session timeout — auto sign-out after 15 minutes of inactivity.
 * Resets the timer on user activity (click, keypress, mousemove, scroll).
 */
export function useDemoTimeout() {
  const isDemo = useIsDemo();
  const [secondsRemaining, setSecondsRemaining] = useState(TIMEOUT_MINUTES * 60);
  const [showWarning, setShowWarning] = useState(false);
  const expiresAtRef = useRef(Date.now() + TIMEOUT_MS);
  const warningShownRef = useRef(false);

  const resetTimer = useCallback(() => {
    if (!isDemo) return;
    expiresAtRef.current = Date.now() + TIMEOUT_MS;
    setSecondsRemaining(TIMEOUT_MINUTES * 60);
    warningShownRef.current = false;
    setShowWarning(false);
  }, [isDemo]);

  // Activity listener — resets on any user interaction
  useEffect(() => {
    if (!isDemo) return;

    const events = ["click", "keypress", "mousemove", "scroll", "touchstart"];
    const handler = () => resetTimer();

    events.forEach((e) => document.addEventListener(e, handler, { passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, handler));
  }, [isDemo, resetTimer]);

  // Countdown interval
  useEffect(() => {
    if (!isDemo) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000));
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        signOut({ callbackUrl: "/auth?timeout=true" });
      } else if (remaining <= 60 && !warningShownRef.current) {
        warningShownRef.current = true;
        setShowWarning(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isDemo]);

  if (!isDemo) return { secondsRemaining: null, showWarning: false };

  return { secondsRemaining, showWarning };
}
