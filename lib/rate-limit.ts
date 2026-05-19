/**
 * In-memory rate limiter untuk API endpoints.
 *
 * Dipakai untuk melindungi endpoint AI/prompt yang bergantung pada layanan
 * eksternal (Groq) dan berpotensi mahal jika disalahgunakan.
 *
 * Implementasi: sliding window counter per userId.
 * Tidak memerlukan Redis — cocok untuk single-instance Vercel serverless.
 * Catatan: counter reset saat cold start (acceptable untuk use case ini).
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Bersihkan entry lama setiap 5 menit untuk mencegah memory leak
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function maybeCleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now - entry.windowStart > windowMs * 2) {
      store.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Jumlah request maksimum dalam window */
  limit: number;
  /** Durasi window dalam milidetik */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Sisa request yang diizinkan dalam window saat ini */
  remaining: number;
  /** Timestamp (ms) kapan window reset */
  resetAt: number;
}

/**
 * Cek apakah request dari `key` (biasanya userId) masih dalam batas.
 * Menggunakan fixed window counter — sederhana dan cukup untuk use case ini.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  maybeCleanup(config.windowMs);

  const entry = store.get(key);

  // Window baru atau window lama sudah expired
  if (!entry || now - entry.windowStart >= config.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Masih dalam window yang sama
  if (entry.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + config.windowMs,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.windowStart + config.windowMs,
  };
}

// ── Preset konfigurasi per endpoint ──────────────────────────────────────────

/**
 * Prompt/record endpoint: 30 request per menit per user.
 * Cukup untuk penggunaan normal (rata-rata user tidak lebih dari 5–10 transaksi/menit).
 */
export const RATE_LIMIT_PROMPT: RateLimitConfig = {
  limit: 30,
  windowMs: 60 * 1000,
};

/**
 * AI analyst endpoint: 10 request per menit per user.
 * Analyst adalah query berat — user jarang perlu refresh lebih dari beberapa kali.
 */
export const RATE_LIMIT_ANALYST: RateLimitConfig = {
  limit: 10,
  windowMs: 60 * 1000,
};

/**
 * Prediction endpoint: 10 request per menit per user.
 * Sama seperti analyst — query berat dengan 3 bulan data.
 */
export const RATE_LIMIT_PREDICTION: RateLimitConfig = {
  limit: 10,
  windowMs: 60 * 1000,
};
