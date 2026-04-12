import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateVerificationToken, getTokenExpiry, canResendEmail } from "@/lib/token-utils";
import { sendVerificationEmail } from "@/lib/email";

// POST /api/auth/resend-verification — kirim ulang email verifikasi
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        verificationTokenExpiry: true,
        password: true,
      },
    });

    // Jangan reveal apakah email terdaftar atau tidak (security)
    if (!user || !user.password) {
      return NextResponse.json({ message: "sent" });
    }

    // Sudah diverifikasi
    if (user.emailVerified) {
      return NextResponse.json({ message: "already_verified" });
    }

    // Rate limit: blokir kalau token dibuat < 5 menit lalu
    if (!canResendEmail(user.verificationTokenExpiry)) {
      return NextResponse.json(
        { error: "Tunggu 5 menit sebelum meminta kirim ulang." },
        { status: 429 }
      );
    }

    // Generate token baru
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = getTokenExpiry();

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpiry },
    });

    // Kirim email (fire and forget)
    sendVerificationEmail(user.email, user.name, verificationToken).catch((err) =>
      console.error("[resend-verification]", err)
    );

    return NextResponse.json({ message: "sent" });
  } catch (error) {
    console.error("[resend-verification]", error);
    return NextResponse.json({ error: "Gagal mengirim email." }, { status: 500 });
  }
}
