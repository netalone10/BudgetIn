import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";
import { getFamilyContext } from "@/lib/family";

type Params = { params: Promise<{ userId: string }> };

// DELETE /api/family/member/[userId]
// - partner mengeluarkan diri sendiri (leave), atau
// - owner mengeluarkan partner.
// Owner tidak bisa dikeluarkan lewat route ini — gunakan DELETE /api/family (bubarkan).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId: targetUserId } = await params;

  const ctx = await getFamilyContext(session.userId);
  if (!ctx) {
    return NextResponse.json({ error: "Kamu tidak tergabung dalam keluarga" }, { status: 404 });
  }

  const target = ctx.members.find((m) => m.userId === targetUserId);
  if (!target) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const isSelf = targetUserId === session.userId;
  const isOwner = ctx.self.role === "owner";

  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Pemilik tidak bisa keluar; bubarkan keluarga sebagai gantinya" },
      { status: 400 }
    );
  }

  // Boleh hapus jika: hapus diri sendiri (leave), atau owner mengeluarkan partner.
  if (!isSelf && !isOwner) {
    return NextResponse.json(
      { error: "Hanya pemilik yang bisa mengeluarkan anggota lain" },
      { status: 403 }
    );
  }

  await prisma.familyMember.delete({
    where: { familyId_userId: { familyId: ctx.family.id, userId: targetUserId } },
  });

  return NextResponse.json({ ok: true });
}
