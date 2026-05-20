/**
 * Cron: sync count transaksi & akun Google Sheets ke cache di User table.
 *
 * Dijadwalkan via vercel.json `0 *\/6 * * *` (tiap 6 jam). Vercel Cron kirim
 * Authorization: Bearer ${CRON_SECRET}.
 *
 * Untuk tiap user dengan sheetsId, ambil access token valid, call
 * countTransactions + countAccounts (lightweight, col A only), simpan ke
 * kolom sheetsTxCount / sheetsAccountCount + sheetsCountSyncedAt.
 *
 * Concurrency 5 — jangan bombardir Google API. Per-user failure di-skip
 * (token expired, sheet deleted, dll); count lama tetap dipakai sampai
 * sync berikutnya.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { countTransactions, countAccounts } from "@/utils/sheets";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const CONCURRENCY = 5;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null;

  if (!expected || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { sheetsId: { not: null } },
    select: { id: true, sheetsId: true },
  });

  let ok = 0;
  let failed = 0;
  const failures: Array<{ userId: string; error: string }> = [];

  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (u) => {
        try {
          const token = await getValidToken(u.id);
          const [txCount, accCount] = await Promise.all([
            countTransactions(u.sheetsId!, token),
            countAccounts(u.sheetsId!, token),
          ]);
          await prisma.user.update({
            where: { id: u.id },
            data: {
              sheetsTxCount: txCount,
              sheetsAccountCount: accCount,
              sheetsCountSyncedAt: new Date(),
            },
          });
          ok++;
        } catch (e) {
          failed++;
          failures.push({
            userId: u.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      })
    );
  }

  // Log ke server log buat audit; jangan return semua failure ke client
  // supaya gak bocor info user lewat cron response.
  if (failures.length > 0) {
    console.warn("[cron-sheets-sync] failures:", failures);
  }

  return NextResponse.json({
    ok,
    failed,
    total: users.length,
    syncedAt: new Date().toISOString(),
  });
}
