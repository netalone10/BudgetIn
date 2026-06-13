import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";

// DELETE — unlink a contribution from a goal.
// Removes the SavingsContribution record only; the underlying Transaction is kept
// so it returns to the "unallocated" pool.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ goalId: string; transactionId: string }> }
) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId, transactionId } = await params;

  const result = await prisma.savingsContribution.deleteMany({
    where: { transactionId, goalId, userId: session.userId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Kontribusi tidak ditemukan" }, { status: 404 });
  }

  // Sheets users: the underlying transaction lives in Sheets, and the Prisma
  // Transaction is only a mirror that anchored this contribution. Remove it so it
  // doesn't linger as a phantom in savings history/unallocated. The Sheets row is
  // untouched and returns to the unallocated pool. (Email users keep their
  // Transaction — it's the real record — so it returns to the pool too.)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });
  if (user?.sheetsId) {
    await prisma.transaction.deleteMany({
      where: { id: transactionId, userId: session.userId },
    });
  }

  return NextResponse.json({ success: true });
}
