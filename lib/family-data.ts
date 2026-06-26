/**
 * Family Mode — consolidation engine.
 *
 * Menggabungkan ledger semua anggota family (lintas storage: DB & Sheets) jadi
 * satu pandangan ter-konsolidasi, ber-tag `ownerUserId` agar bisa breakdown per
 * orang. Net worth dihitung dengan menjumlahkan net worth per anggota (path
 * murah, tanpa merge ledger mentah). Spending/income memakai ledger gabungan.
 *
 * Prinsip akuntansi: agregasi + (Fase 4) eliminasi transfer intra-keluarga.
 * Degradasi anggun: kegagalan satu anggota (mis. token Sheets invalid) tidak
 * menjatuhkan seluruh view — anggota itu ditandai `error` dengan data kosong.
 */
import "server-only";

import { getFamilyContext, type FamilyMemberInfo } from "@/lib/family";
import { getTransactionsDB } from "@/utils/db-transactions";
import { getAccountBalances, calculateNetWorth } from "@/utils/account-balance";
import {
  getFullSheetsLedger,
  getAccountsWithComputedBalance,
} from "@/lib/sheets-data";
import {
  isExpenseTransaction,
  isEquityTransaction,
} from "@/lib/transaction-classification";
import { isSavingsTransaction } from "@/lib/savings-utils";
import { normalizeTransactionTime } from "@/lib/transaction-time";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FamilyRawTxn {
  id: string;
  ownerUserId: string;
  ownerName: string;
  ownerDisplayRole: string | null;
  date: string;
  time: string;
  amount: number;
  category: string;
  note: string;
  type: "expense" | "income" | "transfer_out" | "transfer_in";
  accountId: string | null;
  fromAccountId?: string | null;
  fromAccountName?: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
  // Fase 4 — penanda transfer antar-anggota (untuk eliminasi).
  familyTransferId?: string | null;
  counterpartyUserId?: string | null;
}

export interface FamilyMemberStatus {
  userId: string;
  name: string;
  displayRole: string | null;
  role: string;
  storage: "db" | "sheets";
  error: boolean; // true = gagal memuat ledger anggota ini (perlu login ulang dll)
}

export interface FamilyLedger {
  family: { id: string; name: string };
  members: FamilyMemberStatus[];
  transactions: FamilyRawTxn[];
}

export interface MemberNetWorth {
  userId: string;
  name: string;
  displayRole: string | null;
  assets: number;
  liabilities: number;
  netWorth: number;
  error: boolean;
}

export interface FamilyNetWorth {
  family: { id: string; name: string };
  totalAssets: number;
  totalLiabilities: number;
  totalNetWorth: number;
  perMember: MemberNetWorth[];
}

// ─── Period helpers ───────────────────────────────────────────────────────────

interface DateRange {
  gte: string;
  lte: string;
}

/**
 * Resolusi period ke rentang tanggal (YYYY-MM-DD) untuk filter ledger Sheets
 * in-memory. `null` = semua waktu. Sejajar dengan getTransactionsDB agar kedua
 * storage memakai semantik period yang sama.
 */
function resolvePeriodRange(period: string): DateRange | null {
  const now = new Date();
  const ym = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const low = period.toLowerCase();

  if (low === "semua" || low === "all") return null;
  if (low.startsWith("custom:")) {
    const [, from, to] = period.split(":");
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (DATE_RE.test(from) && DATE_RE.test(to) && from <= to) {
      return { gte: from, lte: to };
    }
  } else if (/^\d{4}-\d{2}$/.test(period)) {
    return { gte: `${period}-01`, lte: `${period}-31` };
  } else if (low.includes("bulan lalu") || low.includes("last month")) {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { gte: `${ym(last)}-01`, lte: `${ym(last)}-31` };
  }
  // default: bulan ini
  return { gte: `${ym(now)}-01`, lte: `${ym(now)}-31` };
}

// ─── Per-member ledger fetch (DB atau Sheets) ─────────────────────────────────

async function getMemberLedger(
  member: FamilyMemberInfo,
  period: string
): Promise<{ transactions: FamilyRawTxn[]; error: boolean }> {
  try {
    if (member.sheetsId) {
      const { transactions } = await getFullSheetsLedger(
        member.userId,
        member.sheetsId
      );
      const range = resolvePeriodRange(period);
      const filtered = range
        ? transactions.filter((t) => t.date >= range.gte && t.date <= range.lte)
        : transactions;
      return {
        transactions: filtered.map((t) => ({
          id: t.id,
          ownerUserId: member.userId,
          ownerName: member.name,
          ownerDisplayRole: member.displayRole,
          date: t.date,
          time: normalizeTransactionTime(t.time),
          amount: t.amount,
          category: t.category,
          note: t.note,
          type: (t.type === "income" ? "income" : "expense") as FamilyRawTxn["type"],
          accountId: t.fromAccountId ?? t.toAccountId ?? null,
          fromAccountId: t.fromAccountId ?? null,
          fromAccountName: t.fromAccountName ?? null,
          toAccountId: t.toAccountId ?? null,
          toAccountName: t.toAccountName ?? null,
          familyTransferId: t.familyTransferId ?? null,
          counterpartyUserId: t.counterpartyUserId ?? null,
        })),
        error: false,
      };
    }

    const txs = await getTransactionsDB(member.userId, period);
    return {
      transactions: txs.map((t) => ({
        id: t.id,
        ownerUserId: member.userId,
        ownerName: member.name,
        ownerDisplayRole: member.displayRole,
        date: t.date,
        time: normalizeTransactionTime(t.time),
        amount: t.amount,
        category: t.category,
        note: t.note,
        type: t.type,
        accountId: t.accountId,
        familyTransferId: t.familyTransferId ?? null,
        counterpartyUserId: t.counterpartyUserId ?? null,
      })),
      error: false,
    };
  } catch (error) {
    console.error(
      `[family-data] gagal memuat ledger anggota ${member.userId}:`,
      error
    );
    return { transactions: [], error: true };
  }
}

// ─── Consolidated ledger ──────────────────────────────────────────────────────

/**
 * Ledger gabungan seluruh anggota family untuk `period`, ber-tag pemilik.
 * `null` jika user tidak tergabung dalam family.
 */
export async function getFamilyLedger(
  userId: string,
  period: string
): Promise<FamilyLedger | null> {
  const ctx = await getFamilyContext(userId);
  if (!ctx) return null;

  const results = await Promise.all(
    ctx.members.map(async (m) => {
      const { transactions, error } = await getMemberLedger(m, period);
      const status: FamilyMemberStatus = {
        userId: m.userId,
        name: m.name,
        displayRole: m.displayRole,
        role: m.role,
        storage: m.sheetsId ? "sheets" : "db",
        error,
      };
      return { status, transactions };
    })
  );

  return {
    family: { id: ctx.family.id, name: ctx.family.name },
    members: results.map((r) => r.status),
    transactions: results.flatMap((r) => r.transactions),
  };
}

// ─── Net worth (sum per anggota) ──────────────────────────────────────────────

async function getMemberNetWorth(
  member: FamilyMemberInfo
): Promise<MemberNetWorth> {
  const base = {
    userId: member.userId,
    name: member.name,
    displayRole: member.displayRole,
  };
  try {
    if (member.sheetsId) {
      const accounts = await getAccountsWithComputedBalance(
        member.userId,
        member.sheetsId
      );
      let assets = 0;
      let liabilities = 0;
      for (const a of accounts) {
        if (a.classification === "liability") liabilities += a.balance;
        else assets += a.balance;
      }
      return { ...base, assets, liabilities, netWorth: assets - liabilities, error: false };
    }

    const accounts = await getAccountBalances(member.userId);
    const nw = calculateNetWorth(accounts);
    return {
      ...base,
      assets: Number(nw.assets),
      liabilities: Number(nw.liabilities),
      netWorth: Number(nw.netWorth),
      error: false,
    };
  } catch (error) {
    console.error(
      `[family-data] gagal menghitung net worth anggota ${member.userId}:`,
      error
    );
    return { ...base, assets: 0, liabilities: 0, netWorth: 0, error: true };
  }
}

/**
 * Net worth keluarga = Σ net worth tiap anggota. Transfer intra/antar-anggota
 * selalu net-zero terhadap total, jadi tidak perlu eliminasi di sini.
 */
export async function getFamilyNetWorth(
  userId: string
): Promise<FamilyNetWorth | null> {
  const ctx = await getFamilyContext(userId);
  if (!ctx) return null;

  const perMember = await Promise.all(ctx.members.map(getMemberNetWorth));

  return {
    family: { id: ctx.family.id, name: ctx.family.name },
    totalAssets: perMember.reduce((s, m) => s + m.assets, 0),
    totalLiabilities: perMember.reduce((s, m) => s + m.liabilities, 0),
    totalNetWorth: perMember.reduce((s, m) => s + m.netWorth, 0),
    perMember,
  };
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

export interface FamilySummary {
  income: number;
  expense: number;
  net: number;
  byCategory: { category: string; spent: number }[];
  byMember: {
    userId: string;
    name: string;
    displayRole: string | null;
    income: number;
    expense: number;
  }[];
}

/**
 * Ringkasan spending/income keluarga dari ledger gabungan.
 * - Skip transaksi equity (Saldo Awal / Penyesuaian Saldo) & tabungan.
 * - (Fase 4) Eliminasi pasangan transfer antar-anggota ber-`familyTransferId`.
 *
 * `savingsCategoryNames` = union nama kategori tabungan semua anggota (lowercase).
 */
export function summarizeFamily(
  transactions: FamilyRawTxn[],
  savingsCategoryNames: Set<string> = new Set()
): FamilySummary {
  // Fase 4: kumpulkan familyTransferId yang punya pasangan lengkap (2 kaki) untuk dieliminasi.
  const transferLegCount = new Map<string, number>();
  for (const t of transactions) {
    if (t.familyTransferId) {
      transferLegCount.set(
        t.familyTransferId,
        (transferLegCount.get(t.familyTransferId) ?? 0) + 1
      );
    }
  }

  const byCategory = new Map<string, number>();
  const byMember = new Map<
    string,
    { userId: string; name: string; displayRole: string | null; income: number; expense: number }
  >();

  let income = 0;
  let expense = 0;

  for (const t of transactions) {
    // Eliminasi transfer antar-anggota (kedua kaki dimiliki anggota family).
    if (t.familyTransferId && (transferLegCount.get(t.familyTransferId) ?? 0) >= 2) {
      continue;
    }
    if (isEquityTransaction(t)) continue;

    const member =
      byMember.get(t.ownerUserId) ??
      {
        userId: t.ownerUserId,
        name: t.ownerName,
        displayRole: t.ownerDisplayRole,
        income: 0,
        expense: 0,
      };

    if (t.type === "income") {
      income += t.amount;
      member.income += t.amount;
    } else if (isExpenseTransaction(t) && !isSavingsTransaction(t.category, savingsCategoryNames)) {
      expense += t.amount;
      member.expense += t.amount;
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
    }

    byMember.set(t.ownerUserId, member);
  }

  return {
    income,
    expense,
    net: income - expense,
    byCategory: [...byCategory.entries()]
      .map(([category, spent]) => ({ category, spent }))
      .sort((a, b) => b.spent - a.spent),
    byMember: [...byMember.values()],
  };
}
