import {
  getCacheControlHeader,
  ROUTE_CACHE_PROFILES,
  type CacheProfile,
} from "@/lib/cache-headers";

describe("getCacheControlHeader", () => {
  it("returns immutable header for static profile", () => {
    expect(getCacheControlHeader({ profile: "static" })).toBe(
      "public, max-age=31536000, immutable"
    );
  });

  it("returns s-maxage with stale-while-revalidate for semi-static profile", () => {
    expect(getCacheControlHeader({ profile: "semi-static" })).toBe(
      "public, s-maxage=60, stale-while-revalidate=300"
    );
  });

  it("returns private no-cache for private-mutable profile", () => {
    expect(getCacheControlHeader({ profile: "private-mutable" })).toBe(
      "private, no-cache"
    );
  });
});

describe("ROUTE_CACHE_PROFILES", () => {
  it("classifies categories and account-types as semi-static", () => {
    expect(ROUTE_CACHE_PROFILES["/api/categories"]).toBe("semi-static");
    expect(ROUTE_CACHE_PROFILES["/api/account-types"]).toBe("semi-static");
  });

  it("classifies user-specific data routes as private-mutable", () => {
    const privateRoutes = [
      "/api/transactions",
      "/api/budget",
      "/api/savings",
      "/api/accounts",
      "/api/cashflow",
      "/api/recurring",
    ];

    for (const route of privateRoutes) {
      expect(ROUTE_CACHE_PROFILES[route]).toBe("private-mutable");
    }
  });

  it("maps every route to a valid CacheProfile", () => {
    const validProfiles: CacheProfile[] = ["static", "semi-static", "private-mutable"];

    for (const profile of Object.values(ROUTE_CACHE_PROFILES)) {
      expect(validProfiles).toContain(profile);
    }
  });
});
