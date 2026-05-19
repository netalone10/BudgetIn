/**
 * Metrik singleton untuk landing page (Pengguna Aktif, Transaksi Dicatat, Rating).
 *
 * Strategi:
 * - `getAppMetrics()` baca cache singleton dari DB (cepat).
 * - Kalau cache stale > MAX_AGE_MS, fire-and-forget refresh di background; return value lama.
 * - Kalau cache belum ada (cold start), hitung minimum sync (DB only) supaya landing langsung ada angka.
 *
 * Refresh Sheets count mahal karena harus iterate semua Google user, refresh
 * OAuth token, dan call Sheets API. Kita timeout per-user dan cap concurrency
 * supaya gak nge-block / kena rate limit.
 */
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";

const SINGLETON_ID = "global";
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 jam
const SHEETS_PER_USER_TIMEOUT_MS = 8000;
const SHEETS_CONCURRENCY = 4;

export type AppMetrics = {
  userCount: number;
  dbTransactionCount: number;
  sheetsTransactionCount: number;
  totalTransactionCount: number;
  approvedTestimonialCount: number;
  avgRating: number;
  refreshedAt: Date;
};

/**
 * Baca metrik dari cache. Kalau stale, trigger refresh background (gak menunggu).
 * Kalau belum pernah dipopulate, hitung sync minimum biar landing punya angka.
 */
export async function getAppMetrics(): Promise<AppMetrics> {
  const row = await prisma.appMetric.findUnique({ where: { id: SINGLETON_ID } });

  if (!row) {
    // Cold start: hitung minimum (DB only, skip Sheets supaya tidak lambat).
    const fast = await computeFastMetrics();
    const created = await prisma.appMetric.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...fast, sheetsTransactionCount: 0 },
      update: {},
    });
    // Trigger refresh penuh di background (mengisi sheets count).
    void refreshAppMetrics().catch((err) => console.error("[app-metrics] background refresh failed", err));
    return toAppMetrics(created);
  }

  const stale = Date.now() - row.refreshedAt.getTime() > MAX_AGE_MS;
  if (stale) {
    void refreshAppMetrics().catch((err) => console.error("[app-metrics] background refresh failed", err));
  }

  return toAppMetrics(row);
}

/**
 * Hitung ulang seluruh metrik dan simpan ke DB. Aman dipanggil paralel
 * (last-write-wins). Dipanggil dari cron, admin trigger, atau background.
 */
export async function refreshAppMetrics(): Promise<AppMetrics> {
  const [
    userCount,
    dbTransactionCount,
    sheetsTransactionCount,
    testiAgg,
    approvedTestimonialCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count(),
    computeSheetsTransactionCount(),
    prisma.testimonial.aggregate({ where: { approved: true }, _avg: { rating: true } }),
    prisma.testimonial.count({ where: { approved: true } }),
  ]);

  const avgRating = Number(testiAgg._avg.rating ?? 0);

  const saved = await prisma.appMetric.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      userCount,
      dbTransactionCount,
      sheetsTransactionCount,
      approvedTestimonialCount,
      avgRating,
    },
    update: {
      userCount,
      dbTransactionCount,
      sheetsTransactionCount,
      approvedTestimonialCount,
      avgRating,
      refreshedAt: new Date(),
    },
  });

  return toAppMetrics(saved);
}

async function computeFastMetrics() {
  const [userCount, dbTransactionCount, testiAgg, approvedTestimonialCount] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.testimonial.aggregate({ where: { approved: true }, _avg: { rating: true } }),
    prisma.testimonial.count({ where: { approved: true } }),
  ]);
  return {
    userCount,
    dbTransactionCount,
    approvedTestimonialCount,
    avgRating: Number(testiAgg._avg.rating ?? 0),
  };
}

/**
 * Iterate semua user yang punya sheetsId, refresh token, fetch transaksi,
 * jumlahkan. Per-user di-wrap dengan timeout + skip-on-error supaya satu user
 * yang revoke access gak nge-block seluruh refresh.
 */
async function computeSheetsTransactionCount(): Promise<number> {
  const users = await prisma.user.findMany({
    where: { sheetsId: { not: null }, accessToken: { not: null } },
    select: { id: true, sheetsId: true },
  });

  let total = 0;
  for (let i = 0; i < users.length; i += SHEETS_CONCURRENCY) {
    const batch = users.slice(i, i + SHEETS_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((u) =>
        withTimeout(countTransactionsForUser(u.id, u.sheetsId!), SHEETS_PER_USER_TIMEOUT_MS)
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled") total += r.value;
    }
  }
  return total;
}

async function countTransactionsForUser(userId: string, sheetsId: string): Promise<number> {
  const token = await getValidToken(userId);
  const txns = await getTransactions(sheetsId, token);
  return txns.length;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function toAppMetrics(row: {
  userCount: number;
  dbTransactionCount: number;
  sheetsTransactionCount: number;
  approvedTestimonialCount: number;
  avgRating: number;
  refreshedAt: Date;
}): AppMetrics {
  return {
    userCount: row.userCount,
    dbTransactionCount: row.dbTransactionCount,
    sheetsTransactionCount: row.sheetsTransactionCount,
    totalTransactionCount: row.dbTransactionCount + row.sheetsTransactionCount,
    approvedTestimonialCount: row.approvedTestimonialCount,
    avgRating: row.avgRating,
    refreshedAt: row.refreshedAt,
  };
}

/**
 * Format angka untuk landing (pakai locale id-ID, dengan suffix "+" kalau besar).
 */
export function formatMetricCount(n: number): string {
  if (n <= 0) return "0";
  // Round down to nice "+ suffix" buckets di angka besar
  if (n >= 10000) {
    const rounded = Math.floor(n / 1000) * 1000;
    return new Intl.NumberFormat("id-ID").format(rounded) + "+";
  }
  if (n >= 1000) {
    const rounded = Math.floor(n / 100) * 100;
    return new Intl.NumberFormat("id-ID").format(rounded) + "+";
  }
  return new Intl.NumberFormat("id-ID").format(n);
}

export function formatRating(avg: number, count: number): string {
  if (count === 0) return "—";
  // 4.83 → "4,8 / 5,0"
  const rounded = Math.round(avg * 10) / 10;
  return rounded.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " / 5,0";
}
