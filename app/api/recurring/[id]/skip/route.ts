import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";
import { calcNextOccurrence, type RecurringFrequency } from "@/utils/recurring-utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const r = await prisma.recurringTransaction.findUnique({ where: { id } });
  if (!r || r.userId !== session.userId) {
    return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  }

  const nextDueDate = calcNextOccurrence(
    r.frequency as RecurringFrequency,
    r.interval,
    r.nextDueDate, // skip = step from current due
    r.nextDueDate,
  );

  await prisma.recurringTransaction.update({
    where: { id },
    data: { nextDueDate },
  });

  return NextResponse.json({ success: true, nextDueDate });
}
