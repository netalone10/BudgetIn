import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";
import { runRecurringOccurrence } from "@/utils/recurring-executor";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.recurringTransaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  }

  let body: { amount?: unknown; note?: unknown } = {};
  try { body = await request.json(); } catch {}
  const amount = body.amount != null ? Number(body.amount) : undefined;
  const note = typeof body.note === "string" ? body.note : undefined;

  const result = await runRecurringOccurrence(id, new Date(), amount, note);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.alreadyRan) {
    return NextResponse.json({ error: "Sudah pernah dijalankan hari ini." }, { status: 409 });
  }
  return NextResponse.json({ success: true, nextDueDate: result.nextDueDate });
}
