"use client";

import { useSession } from "next-auth/react";

/** Returns true if the current session user is the demo account. */
export function useIsDemo(): boolean {
  const { data: session } = useSession();
  return session?.isDemo === true;
}
