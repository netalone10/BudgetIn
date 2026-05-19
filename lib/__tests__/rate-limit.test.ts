import { checkRateLimit, RATE_LIMIT_PROMPT, RATE_LIMIT_ANALYST, RATE_LIMIT_PREDICTION } from "@/lib/rate-limit";

// Helper: buat key unik per test agar tidak ada state yang bocor antar test
let counter = 0;
function uniqueKey(prefix = "user") {
  return `${prefix}-${++counter}-${Math.random().toString(36).slice(2)}`;
}

describe("checkRateLimit", () => {
  it("mengizinkan request pertama", () => {
    const result = checkRateLimit(uniqueKey(), { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("menghitung remaining dengan benar", () => {
    const key = uniqueKey();
    const config = { limit: 3, windowMs: 60_000 };
    checkRateLimit(key, config); // 1
    checkRateLimit(key, config); // 2
    const r = checkRateLimit(key, config); // 3
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("memblokir request setelah limit tercapai", () => {
    const key = uniqueKey();
    const config = { limit: 2, windowMs: 60_000 };
    checkRateLimit(key, config); // 1
    checkRateLimit(key, config); // 2
    const r = checkRateLimit(key, config); // 3 — harus diblokir
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("resetAt berada di masa depan", () => {
    const before = Date.now();
    const r = checkRateLimit(uniqueKey(), { limit: 5, windowMs: 60_000 });
    expect(r.resetAt).toBeGreaterThan(before);
  });

  it("key berbeda tidak saling mempengaruhi", () => {
    const config = { limit: 1, windowMs: 60_000 };
    const key1 = uniqueKey("a");
    const key2 = uniqueKey("b");
    checkRateLimit(key1, config); // key1 habis
    const r = checkRateLimit(key2, config); // key2 masih fresh
    expect(r.allowed).toBe(true);
  });

  it("window baru dimulai setelah windowMs berlalu", () => {
    const key = uniqueKey();
    const config = { limit: 1, windowMs: 50 }; // window sangat pendek
    checkRateLimit(key, config); // habis
    const blocked = checkRateLimit(key, config);
    expect(blocked.allowed).toBe(false);

    // Tunggu window expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const fresh = checkRateLimit(key, config);
        expect(fresh.allowed).toBe(true);
        resolve();
      }, 60);
    });
  });
});

describe("preset konfigurasi", () => {
  it("RATE_LIMIT_PROMPT: 30 req/menit", () => {
    expect(RATE_LIMIT_PROMPT.limit).toBe(30);
    expect(RATE_LIMIT_PROMPT.windowMs).toBe(60_000);
  });

  it("RATE_LIMIT_ANALYST: 10 req/menit", () => {
    expect(RATE_LIMIT_ANALYST.limit).toBe(10);
    expect(RATE_LIMIT_ANALYST.windowMs).toBe(60_000);
  });

  it("RATE_LIMIT_PREDICTION: 10 req/menit", () => {
    expect(RATE_LIMIT_PREDICTION.limit).toBe(10);
    expect(RATE_LIMIT_PREDICTION.windowMs).toBe(60_000);
  });
});
