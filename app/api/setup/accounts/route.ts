/**
 * Tujuan: Setup akun awal user baru via AI prompt — fase parse (preview) & commit (buat akun).
 * Caller: components/SetupAccountsModal.tsx
 * Dependensi: utils/setup/account-setup-groq, utils/setup/create-account-with-balance,
 *             utils/account-types, lib/rate-limit, utils/token
 * Side Effects: commit → DB/Sheets write (akun + transaksi saldo awal)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMIT_PROMPT } from "@/lib/rate-limit";
import { blockDemoResponse } from "@/lib/demo-account";
import { invalidateDashboardCache } from "@/lib/cache";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { getValidToken } from "@/utils/token";
import { parseAccountSetup } from "@/utils/setup/account-setup-groq";
import {
  createAccountWithOpeningBalance,
  type SheetsContext,
} from "@/utils/setup/create-account-with-balance";

interface CommitAccount {
  name?: unknown;
  typeName?: unknown;
  classification?: unknown;
  saldoAwal?: unknown;
  currency?: unknown;
  tanggalSettlement?: unknown;
  tanggalJatuhTempo?: unknown;
}

function validateCommitAccount(a: CommitAccount): { error: string } | {
  name: string;
  typeName: string;
  classification: "asset" | "liability";
  saldoAwal: number;
  currency: string;
  tanggalSettlement: number | null;
  tanggalJatuhTempo: number | null;
} {
  const name = typeof a.name === "string" ? a.name.trim() : "";
  if (!name) return { error: "Nama akun tidak boleh kosong." };
  if (name.length > 50) return { error: `Nama akun "${name.slice(0, 20)}…" maksimal 50 karakter.` };

  const typeName = typeof a.typeName === "string" && a.typeName.trim() ? a.typeName.trim() : "Lainnya";
  // Tipe liability selalu liability — jaga arah transaksi saldo awal tetap benar.
  const classification: "asset" | "liability" =
    typeName === "Kartu Kredit" || typeName === "Hutang"
      ? "liability"
      : a.classification === "liability"
        ? "liability"
        : "asset";

  let saldoAwal = 0;
  if (a.saldoAwal !== undefined && a.saldoAwal !== null && a.saldoAwal !== "") {
    saldoAwal = Number(a.saldoAwal);
    if (!isFinite(saldoAwal) || saldoAwal < 0) return { error: `Saldo awal "${name}" tidak valid.` };
  }

  const currency = typeof a.currency === "string" && a.currency.trim() ? a.currency.trim() : "IDR";

  let tanggalSettlement: number | null = null;
  let tanggalJatuhTempo: number | null = null;
  if (typeName === "Kartu Kredit") {
    tanggalSettlement = typeof a.tanggalSettlement === "number" ? a.tanggalSettlement : 17;
    tanggalJatuhTempo = typeof a.tanggalJatuhTempo === "number" ? a.tanggalJatuhTempo : 5;
    if (tanggalSettlement < 1 || tanggalSettlement > 31) return { error: `Tanggal settlement "${name}" harus 1-31.` };
    if (tanggalJatuhTempo < 1 || tanggalJatuhTempo > 31) return { error: `Tanggal jatuh tempo "${name}" harus 1-31.` };
  }

  return { name, typeName, classification, saldoAwal, currency, tanggalSettlement, tanggalJatuhTempo };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;

  const userId = session.userId;

  const rl = checkRateLimit(`setup:${userId}`, RATE_LIMIT_PROMPT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak request. Tunggu sebentar sebelum mencoba lagi." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(RATE_LIMIT_PROMPT.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        },
      }
    );
  }

  const body = await req.json();
  const action = body?.action;

  // ── Fase 1: parse (preview, NO write) ─────────────────────────────────────────
  if (action === "parse") {
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    if (!prompt.trim()) return NextResponse.json({ error: "Prompt kosong" }, { status: 400 });

    await ensureDefaultAccountTypes(userId);
    const [result, accountTypes] = await Promise.all([
      parseAccountSetup(prompt),
      prisma.accountType.findMany({
        where: { userId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, classification: true },
      }),
    ]);

    return NextResponse.json({
      accounts: result.accounts,
      clarification: result.clarification,
      accountTypes,
    });
  }

  // ── Fase 2: commit (buat akun) ────────────────────────────────────────────────
  if (action === "commit") {
    const rawAccounts: CommitAccount[] = Array.isArray(body.accounts) ? body.accounts : [];
    if (rawAccounts.length === 0) {
      return NextResponse.json({ error: "Tidak ada akun untuk dibuat." }, { status: 400 });
    }
    if (rawAccounts.length > 30) {
      return NextResponse.json({ error: "Maksimal 30 akun sekaligus." }, { status: 400 });
    }

    // Resolve konteks Sheets sekali (hindari fetch token berulang dalam loop).
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { sheetsId: true },
    });
    let sheetsCtx: SheetsContext | null = null;
    if (user?.sheetsId) {
      try {
        sheetsCtx = { sheetsId: user.sheetsId, accessToken: await getValidToken(userId) };
      } catch {
        return NextResponse.json({ error: "token_expired" }, { status: 401 });
      }
    }

    const created: Array<{ id: string; name: string; currentBalance: string }> = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (const raw of rawAccounts) {
      const validated = validateCommitAccount(raw);
      if ("error" in validated) {
        const label = typeof raw.name === "string" ? raw.name : "(tanpa nama)";
        failed.push({ name: label, error: validated.error });
        continue;
      }
      try {
        const acc = await createAccountWithOpeningBalance(userId, validated, sheetsCtx);
        created.push(acc);
      } catch (e) {
        // Duplikat nama (unique constraint) atau error lain — non-fatal, lanjut akun berikutnya.
        const msg =
          e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002"
            ? "Nama akun sudah dipakai."
            : "Gagal dibuat.";
        failed.push({ name: validated.name, error: msg });
      }
    }

    if (created.length > 0) invalidateDashboardCache(userId);

    return NextResponse.json({ created, failed }, { status: created.length > 0 ? 201 : 400 });
  }

  return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
}
