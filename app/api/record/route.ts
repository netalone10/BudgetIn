import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyIntent } from "@/utils/groq";
import { getValidToken } from "@/utils/token";
import { getTransactions, getAccounts, ensureAccountHeader } from "@/utils/sheets";
import { getTransactionsDB } from "@/utils/db-transactions";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { NON_MONETARY_UNITS, MONETARY_INDICATOR, REPORT_KEYWORDS } from "@/utils/record/amount-parser";
import { handleTransaksi, handleTransaksiBulk, handlePemasukan, handleBudgetSetting, handleLaporan } from "@/utils/record/intent-handlers";
import type { RuntimeAccount } from "@/utils/record/account-resolver";

const TIMEZONE = "Asia/Jakarta";

// ── GET — load riwayat transaksi ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "bulan ini";
  const customFrom = searchParams.get("from");
  const customTo = searchParams.get("to");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  // Resolve period — custom range override
  const resolvedPeriod = (period === "custom" && customFrom && customTo)
    ? `custom:${customFrom}:${customTo}`
    : period;

  // ── Email user: baca dari DB ──────────────────────────────────────────────
  if (!user?.sheetsId) {
    try {
      const transactions = await getTransactionsDB(session.userId, resolvedPeriod);
      return NextResponse.json({ transactions: transactions.slice(0, 200) });
    } catch {
      return NextResponse.json({ transactions: [] });
    }
  }

  // ── Google user: baca dari Sheets ─────────────────────────────────────────
  let accessToken: string;
  try {
    accessToken = await getValidToken(session.userId);
  } catch {
    return NextResponse.json({ error: "token_expired" }, { status: 401 });
  }
  try {
    const transactions = await getTransactions(user.sheetsId, accessToken, resolvedPeriod);
    transactions.sort((a, b) => (a.date < b.date ? 1 : -1));
    return NextResponse.json({ transactions: transactions.slice(0, 200) });
  } catch {
    return NextResponse.json({ transactions: [] });
  }
}

// ── POST — klasifikasi intent + simpan ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt kosong" }, { status: 400 });
  }

  // Ambil user data + kategori
  const [user, userCategories] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { sheetsId: true },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const useSheets = !!user?.sheetsId;
  let userAccounts: RuntimeAccount[] = [];
  const categoryNames = userCategories.map((c) => c.name);

  // Token hanya diperlukan untuk Google/Sheets users
  let accessToken = "";
  if (useSheets) {
    try {
      accessToken = await getValidToken(userId);
      await ensureAccountHeader(user!.sheetsId!, accessToken).catch(() => {});
    } catch {
      return NextResponse.json(
        { error: "Sesi expired. Silakan login ulang." },
        { status: 401 }
      );
    }

    const sheetsAccounts = await getAccounts(user!.sheetsId!, accessToken);
    userAccounts = sheetsAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      classification: account.classification === "liability" ? "liability" : "asset",
    }));
  } else {
    const [, dbAccounts] = await Promise.all([
      ensureDefaultAccountTypes(userId),
      prisma.account.findMany({
        where: { userId, isActive: true },
        select: { id: true, name: true, accountType: { select: { classification: true } } },
        orderBy: { name: "asc" },
      }),
    ]);
    userAccounts = dbAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      classification: account.accountType.classification === "liability" ? "liability" : "asset",
    }));
  }

  const accountNames = userAccounts.map((a) => a.name);

  // Pre-check: satuan non-uang tanpa nominal IDR → tolak sebelum hit Groq
  if (!REPORT_KEYWORDS.test(prompt) && NON_MONETARY_UNITS.test(prompt) && !MONETARY_INDICATOR.test(prompt)) {
    return NextResponse.json({
      intent: "unknown",
      clarification: "Input harus mengandung nominal uang (contoh: 35rb, 2jt). Untuk aset non-uang, tulis nilainya dalam IDR — misal: 'jual saham BBCA dapat 5jt'.",
    });
  }

  // Classify intent via Groq
  let parsed;
  try {
    parsed = await classifyIntent(prompt, categoryNames, accountNames);
  } catch {
    return NextResponse.json({ error: "AI sedang tidak tersedia. Coba lagi." }, { status: 503 });
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[record] parsed:", JSON.stringify(parsed, null, 2));
  }

  const today = format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM-dd");
  const currentMonth = format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM");

  const ctx = {
    userId,
    useSheets,
    sheetsId: user?.sheetsId ?? undefined,
    accessToken,
    userAccounts,
    prompt,
    today,
    currentMonth,
  };

  if (parsed.intent === "transaksi")      return handleTransaksi(parsed, ctx);
  if (parsed.intent === "transaksi_bulk") return handleTransaksiBulk(parsed, ctx);
  if (parsed.intent === "pemasukan")      return handlePemasukan(parsed, ctx);
  if (parsed.intent === "budget_setting") return handleBudgetSetting(parsed, ctx);
  if (parsed.intent === "laporan")        return handleLaporan(parsed, ctx);

  return NextResponse.json({
    intent: "unknown",
    clarification: parsed.clarification ?? "Maksudnya catat transaksi atau set budget?",
  });
}
