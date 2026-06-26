import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";
import { getFamilyContext, type FamilyMemberInfo } from "@/lib/family";
import { getValidToken } from "@/utils/token";
import { appendTransaction, deleteTransaction } from "@/utils/sheets";
import { getAccountBalances } from "@/utils/account-balance";
import { getAccountsWithComputedBalance } from "@/lib/sheets-data";

const TIMEZONE = "Asia/Jakarta";
const CATEGORY = "Transfer Keluarga";

type LegKind = "expense" | "income";
interface WrittenLeg {
  store: "db" | "sheets";
  userId: string;
  sheetsId: string | null;
  id: string;
}

async function getMemberAccountMap(
  member: FamilyMemberInfo
): Promise<Map<string, string>> {
  const list = member.sheetsId
    ? (await getAccountsWithComputedBalance(member.userId, member.sheetsId)).map((a) => ({
        id: a.id,
        name: a.name,
      }))
    : (await getAccountBalances(member.userId)).map((a) => ({ id: a.id, name: a.name }));
  return new Map(list.map((a) => [a.id, a.name]));
}

async function writeLeg(
  member: FamilyMemberInfo,
  leg: {
    kind: LegKind;
    accountId: string;
    accountName: string;
    amount: number;
    note: string;
    date: string;
    familyTransferId: string;
    counterpartyUserId: string;
  }
): Promise<WrittenLeg> {
  if (member.sheetsId) {
    const token = await getValidToken(member.userId);
    const created = await appendTransaction(member.sheetsId, token, {
      date: leg.date,
      amount: leg.amount,
      category: CATEGORY,
      note: leg.note,
      type: leg.kind,
      // expense → akun sumber (from); income → akun tujuan (to)
      ...(leg.kind === "expense"
        ? { fromAccountId: leg.accountId, fromAccountName: leg.accountName }
        : { toAccountId: leg.accountId, toAccountName: leg.accountName }),
      familyTransferId: leg.familyTransferId,
      counterpartyUserId: leg.counterpartyUserId,
    });
    return { store: "sheets", userId: member.userId, sheetsId: member.sheetsId, id: created.id };
  }

  const created = await prisma.transaction.create({
    data: {
      id: randomUUID(),
      userId: member.userId,
      date: leg.date,
      amount: leg.amount,
      category: CATEGORY,
      note: leg.note,
      type: leg.kind,
      accountId: leg.accountId,
      familyTransferId: leg.familyTransferId,
      counterpartyUserId: leg.counterpartyUserId,
    },
  });
  return { store: "db", userId: member.userId, sheetsId: null, id: created.id };
}

async function rollbackLeg(leg: WrittenLeg): Promise<void> {
  try {
    if (leg.store === "sheets" && leg.sheetsId) {
      const token = await getValidToken(leg.userId);
      await deleteTransaction(leg.sheetsId, token, leg.id);
    } else {
      await prisma.transaction.delete({ where: { id: leg.id } });
    }
  } catch (err) {
    console.error("[family/transfer] rollback gagal — kaki menggantung:", leg, err);
  }
}

// POST /api/family/transfer
// Transfer antar-anggota (Opsi A): auto-create sepasang kaki — expense di
// pengirim + income di penerima — berbagi familyTransferId untuk eliminasi.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const toUserId = typeof body.toUserId === "string" ? body.toUserId : "";
  const fromAccountId = typeof body.fromAccountId === "string" ? body.fromAccountId : "";
  const toAccountId = typeof body.toAccountId === "string" ? body.toAccountId : "";
  const amount = Number(body.amount);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM-dd");

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Nominal harus lebih dari 0" }, { status: 400 });
  }
  if (!fromAccountId || !toAccountId) {
    return NextResponse.json({ error: "Akun sumber & tujuan wajib dipilih" }, { status: 400 });
  }

  const ctx = await getFamilyContext(session.userId);
  if (!ctx) {
    return NextResponse.json({ error: "Kamu tidak tergabung dalam keluarga" }, { status: 404 });
  }

  const sender = ctx.self;
  const receiver = ctx.members.find((m) => m.userId === toUserId);
  if (!receiver || receiver.userId === sender.userId) {
    return NextResponse.json({ error: "Anggota tujuan tidak valid" }, { status: 400 });
  }

  // Validasi kepemilikan akun di store masing-masing.
  const [senderAccts, receiverAccts] = await Promise.all([
    getMemberAccountMap(sender),
    getMemberAccountMap(receiver),
  ]);
  const fromName = senderAccts.get(fromAccountId);
  const toName = receiverAccts.get(toAccountId);
  if (!fromName) {
    return NextResponse.json({ error: "Akun sumber tidak ditemukan" }, { status: 400 });
  }
  if (!toName) {
    return NextResponse.json({ error: "Akun tujuan tidak ditemukan" }, { status: 400 });
  }

  const familyTransferId = randomUUID();
  const senderLabel = sender.displayRole || sender.name;
  const receiverLabel = receiver.displayRole || receiver.name;

  // Tulis kaki penerima dulu; jika kaki pengirim gagal, rollback penerima.
  // Atomicity lintas store (DB+Sheets) tidak dijamin DB transaction — pakai
  // kompensasi best-effort agar tidak ada pasangan yang menggantung.
  let receiverLeg: WrittenLeg;
  try {
    receiverLeg = await writeLeg(receiver, {
      kind: "income",
      accountId: toAccountId,
      accountName: toName,
      amount,
      note: note || `Transfer dari ${senderLabel}`,
      date,
      familyTransferId,
      counterpartyUserId: sender.userId,
    });
  } catch (err) {
    console.error("[family/transfer] gagal menulis kaki penerima:", err);
    return NextResponse.json(
      { error: "Gagal mencatat di akun penerima (mungkin perlu login ulang)" },
      { status: 502 }
    );
  }

  try {
    await writeLeg(sender, {
      kind: "expense",
      accountId: fromAccountId,
      accountName: fromName,
      amount,
      note: note || `Transfer ke ${receiverLabel}`,
      date,
      familyTransferId,
      counterpartyUserId: receiver.userId,
    });
  } catch (err) {
    console.error("[family/transfer] gagal menulis kaki pengirim — rollback penerima:", err);
    await rollbackLeg(receiverLeg);
    return NextResponse.json({ error: "Gagal mencatat transfer" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, familyTransferId });
}
