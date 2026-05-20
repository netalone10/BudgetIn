/**
 * Throttled heartbeat untuk update User.lastActivityAt.
 *
 * Dipanggil dari NextAuth session callback (fires tiap authenticated request
 * yang call getServerSession). Throttle in-memory 5 menit per user supaya
 * gak hit DB tiap request — overhead per call cuma Map.get + cek timestamp.
 *
 * Persistensi in-memory cross-request mengandalkan Fluid Compute instance
 * reuse. Cold start = first heartbeat after restart hit DB (acceptable).
 *
 * Pattern sama dengan lib/rate-limit.ts.
 */
import { prisma } from "@/lib/prisma";

const lastUpdate = new Map<string, number>();
const THROTTLE_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
let lastCleanup = Date.now();

function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, ts] of lastUpdate) {
    if (now - ts > THROTTLE_MS * 4) lastUpdate.delete(key);
  }
}

/**
 * Fire-and-forget: tidak boleh await di hot path — return langsung supaya
 * gak nge-block session callback.
 */
export function heartbeat(userId: string): void {
  if (!userId) return;
  const now = Date.now();
  const last = lastUpdate.get(userId);
  if (last && now - last < THROTTLE_MS) return;
  lastUpdate.set(userId, now);
  maybeCleanup();

  prisma.user
    .update({
      where: { id: userId },
      data: { lastActivityAt: new Date() },
    })
    .catch((e) => {
      // User mungkin udah ke-delete antar request; jangan crash.
      console.error("[heartbeat] failed for user", userId, e);
    });
}
