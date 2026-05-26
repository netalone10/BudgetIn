import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateResetPasswordToken,
  getResetPasswordTokenExpiry,
  canRequestPasswordReset,
} from "@/lib/token-utils";
import { sendForgotPasswordEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email diperlukan." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      resetPasswordTokenExpiry: true,
    },
  });

  // Selalu kembalikan 200 agar tidak bocorkan apakah email terdaftar
  if (!user || !user.password) {
    return NextResponse.json({ ok: true });
  }

  // Rate limit: 1 menit antar request
  if (!canRequestPasswordReset(user.resetPasswordTokenExpiry)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Tunggu 1 menit sebelum mencoba lagi." },
      { status: 429 }
    );
  }

  const token = generateResetPasswordToken();
  const expiry = getResetPasswordTokenExpiry();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: token,
      resetPasswordTokenExpiry: expiry,
    },
  });

  await sendForgotPasswordEmail(user.email, user.name, token).catch(() => {});

  return NextResponse.json({ ok: true });
}
