import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";
import { getFamilyContext } from "@/lib/family";
import { sendFamilyInviteEmail } from "@/lib/email";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/family/invite — kirim undangan via email (owner only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayRole =
    typeof body.displayRole === "string" && body.displayRole.trim()
      ? body.displayRole.trim()
      : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
  }

  const ctx = await getFamilyContext(session.userId);
  if (!ctx) {
    return NextResponse.json(
      { error: "Buat keluarga dulu sebelum mengundang" },
      { status: 404 }
    );
  }
  if (ctx.self.role !== "owner") {
    return NextResponse.json(
      { error: "Hanya pemilik yang bisa mengundang anggota" },
      { status: 403 }
    );
  }

  if (email === ctx.self.email.toLowerCase()) {
    return NextResponse.json({ error: "Tidak bisa mengundang diri sendiri" }, { status: 400 });
  }
  if (ctx.members.some((m) => m.email.toLowerCase() === email)) {
    return NextResponse.json(
      { error: "Orang ini sudah jadi anggota keluarga" },
      { status: 409 }
    );
  }

  // Jika email tujuan sudah punya akun & sudah tergabung family lain → tolak dini.
  const invitee = await prisma.user.findUnique({
    where: { email },
    select: { id: true, familyMembership: { select: { id: true } } },
  });
  if (invitee?.familyMembership) {
    return NextResponse.json(
      { error: "Pengguna ini sudah tergabung di keluarga lain" },
      { status: 409 }
    );
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  // Upsert: ganti undangan pending yang lama untuk email yang sama di family ini.
  await prisma.familyInvite.deleteMany({
    where: { familyId: ctx.family.id, email, status: "pending" },
  });
  await prisma.familyInvite.create({
    data: {
      familyId: ctx.family.id,
      email,
      token,
      role: "partner",
      displayRole,
      expiresAt,
    },
  });

  // Fire-and-forget — kegagalan email tidak membatalkan pembuatan undangan.
  sendFamilyInviteEmail({
    to: email,
    inviterName: ctx.self.name,
    familyName: ctx.family.name,
    displayRole,
    token,
  }).catch((err) => console.error("[family/invite] sendFamilyInviteEmail error:", err));

  return NextResponse.json({ ok: true, email, expiresAt });
}
