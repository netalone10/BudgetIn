"use client";

import useSWR from "swr";

async function reportFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || "Gagal memuat laporan.");
  }
  return json as T;
}

export interface UseReportResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * SWR-based fetcher for report endpoints.
 *
 * Replaces the manual `useState` + `useEffect` fetch pattern so we never call
 * `setState` synchronously inside an effect. `loading` is true on the initial
 * load of each distinct key (e.g. each month/year), preserving the skeleton
 * shown when the selected period changes. Server-provided error messages are
 * preserved via {@link reportFetcher}.
 */
export function useReport<T>(url: string | null): UseReportResult<T> {
  const { data, error, isLoading, mutate } = useSWR<T>(url, reportFetcher, {
    revalidateOnFocus: false,
  });

  return {
    data: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? "Terjadi kesalahan." : null,
    refetch: () => {
      void mutate();
    },
  };
}
