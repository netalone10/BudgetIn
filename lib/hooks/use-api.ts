"use client";

import useSWR, { mutate, type SWRResponse } from "swr";
import { useCallback, useState } from "react";

export interface UseApiOptions<T> {
  fallbackData?: T;
  revalidateOnFocus?: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

/**
 * SWR-based data fetching hook with request deduplication and retry.
 *
 * - Deduplicates identical requests within a 2-second window.
 * - Retries failed requests up to 3 times with exponential backoff.
 * - Disables revalidation on window focus by default.
 */
export function useApi<T>(
  endpoint: string | null,
  options?: UseApiOptions<T>
): SWRResponse<T> {
  return useSWR<T>(endpoint, fetcher, {
    fallbackData: options?.fallbackData,
    revalidateOnFocus: options?.revalidateOnFocus ?? false,
    dedupingInterval: 2000,
    errorRetryCount: 3,
    onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
      // Don't retry on 4xx client errors (except 429 rate limit)
      if (error instanceof Error && error.message.includes("API error: 4") && !error.message.includes("429")) {
        return;
      }
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.min(1000 * 2 ** retryCount, 30000);
      setTimeout(() => revalidate({ retryCount }), delay);
    },
  });
}

// --- Optimistic Mutation Support ---

export interface OptimisticMutationOptions<T, M> {
  endpoint: string;
  mutationType: "create" | "update" | "delete";
  mutationData: M;
  currentData: T[];
  optimisticTransform: (current: T[], mutation: M) => T[];
  rollbackData: T[];
}

/**
 * Applies an optimistic transform to the current data array.
 * Returns the new optimistic state based on the provided transform function.
 */
export function applyOptimisticUpdate<T, M>(
  options: OptimisticMutationOptions<T, M>
): T[] {
  return options.optimisticTransform(options.currentData, options.mutationData);
}

export interface UseOptimisticMutationResult<T> {
  trigger: (data: Partial<T>, type: "create" | "update" | "delete") => Promise<T>;
  isMutating: boolean;
}

/**
 * Hook for performing optimistic mutations with SWR cache.
 *
 * Optimistically updates the local SWR cache before the server confirms
 * the mutation. Rolls back to previous data on failure.
 */
export function useOptimisticMutation<T extends Record<string, unknown>>(
  endpoint: string
): UseOptimisticMutationResult<T> {
  const [isMutating, setIsMutating] = useState(false);

  const trigger = useCallback(
    async (data: Partial<T>, type: "create" | "update" | "delete"): Promise<T> => {
      setIsMutating(true);

      try {
        const result = await mutate<T>(
          endpoint,
          async (currentData: T | undefined) => {
            const method =
              type === "create" ? "POST" : type === "update" ? "PUT" : "DELETE";

            const res = await fetch(endpoint, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });

            if (!res.ok) {
              throw new Error(`API error: ${res.status}`);
            }

            return res.json() as Promise<T>;
          },
          {
            optimisticData: (currentData: T | undefined) => {
              if (!currentData) return data as T;

              // For array-based cache entries, apply the optimistic transform
              if (Array.isArray(currentData)) {
                switch (type) {
                  case "create":
                    return [...currentData, data] as unknown as T;
                  case "update":
                    return currentData.map((item: unknown) => {
                      const record = item as Record<string, unknown>;
                      return record.id === (data as Record<string, unknown>).id
                        ? { ...record, ...data }
                        : item;
                    }) as unknown as T;
                  case "delete":
                    return currentData.filter((item: unknown) => {
                      const record = item as Record<string, unknown>;
                      return record.id !== (data as Record<string, unknown>).id;
                    }) as unknown as T;
                  default:
                    return currentData;
                }
              }

              // For single-object cache entries, merge the data
              return { ...currentData, ...data } as T;
            },
            rollbackOnError: true,
            revalidate: true,
          }
        );

        return result as T;
      } finally {
        setIsMutating(false);
      }
    },
    [endpoint]
  );

  return { trigger, isMutating };
}
