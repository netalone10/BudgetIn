export type CacheProfile = "static" | "semi-static" | "private-mutable";

export interface CacheHeaderConfig {
  profile: CacheProfile;
}

const CACHE_HEADERS: Record<CacheProfile, string> = {
  "static": "public, max-age=31536000, immutable",
  "semi-static": "public, s-maxage=60, stale-while-revalidate=300",
  "private-mutable": "private, no-cache",
};

export function getCacheControlHeader(config: CacheHeaderConfig): string {
  return CACHE_HEADERS[config.profile];
}

// Route classification map
export const ROUTE_CACHE_PROFILES: Record<string, CacheProfile> = {
  "/api/categories": "semi-static",
  "/api/account-types": "semi-static",
  "/api/transactions": "private-mutable",
  "/api/budget": "private-mutable",
  "/api/savings": "private-mutable",
  "/api/accounts": "private-mutable",
  "/api/cashflow": "private-mutable",
  "/api/recurring": "private-mutable",
};
