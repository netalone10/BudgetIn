"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { localStorageProvider } from "@/lib/cache-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig
        value={{
          provider: localStorageProvider,
          revalidateOnFocus: true,
          revalidateOnReconnect: true,
          dedupingInterval: 2000, // Dedupe identical requests within 2s
        }}
      >
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}
