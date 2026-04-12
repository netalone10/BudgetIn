import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/is-admin";
import bcrypt from "bcryptjs";
import { generateRandomPassword, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { generateVerificationToken, getTokenExpiry } from "@/lib/token-utils";

async function guardAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !isAdmin(session.user?.email)) return null;
  return session;
}

// DELETE /api/admin/users/[userId] — hapus user + semua data
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await guardAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;

  // Jangan hapus diri sendiri
  if (userId === session.userId) {
    return NextResponse.json({ error: "Tidak bisa hapus akun sendiri." }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/delete-user]", err);
    return NextResponse.json({ error: "Gagal menghapus user." }, { status: 500 });
  }
}

// POST /api/admin/users/[userId]/reset-password dipanggil lewat sub-route
// tapi kita handle di sini via action query param supaya lebih simple
// POST /api/admin/users/[userId]?action=reset-password
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await guardAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // ── Reset Password ───────────────────────────────────────────────────────
  if (action === "reset-password") {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, password: true },
      });

      if (!user) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
      if (!user.password) {
        return NextResponse.json(
          { error: "User ini login via Google, tidak bisa reset password." },
          { status: 400 }
        );
      }

      const newPassword = generateRandomPassword();
      const hashed = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashed },
      });

      await sendPasswordResetEmail(user.email, user.name, newPassword);
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[admin/reset-password]", err);
      return NextResponse.json({ error: "Gagal reset password." }, { status: 500 });
    }
  }

  // ── Resend Verification ───────────────────────────────────────────────────
  if (action === "resend-verification") {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, password: true, emailVerified: true },
      });

      if (!user) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
      if (!user.password) {
        return NextResponse.json({ error: "User ini login via Google." }, { status: 400 });
      }
      if (user.emailVerified) {
        return NextResponse.json({ error: "Email sudah terverifikasi." }, { status: 400 });
      }

      const verificationToken = generateVerificationToken();
      const verificationTokenExpiry = getTokenExpiry();

      await prisma.user.update({
        where: { id: userId },
        data: { verificationToken, verificationTokenExpiry },
      });

      await sendVerificationEmail(user.email, user.name, verificationToken);
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[admin/resend-verification]", err);
      return NextResponse.json({ error: "Gagal kirim email verifikasi." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
