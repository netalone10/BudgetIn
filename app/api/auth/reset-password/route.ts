import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluatePassword } from "@/lib/password-strength";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token tidak valid." }, { status: 400 });
  }

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password baru diperlukan." }, { status: 400 });
  }

  const strength = evaluatePassword(password);
  if (!strength.acceptable) {
    return NextResponse.json(
      { error: "Password terlalu lemah. Minimal 8 karakter dengan huruf dan angka." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { resetPasswordToken: token },
    select: { id: true, resetPasswordTokenExpiry: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Link reset tidak valid atau sudah digunakan." },
      { status: 400 }
    );
  }

  if (!user.resetPasswordTokenExpiry || user.resetPasswordTokenExpiry < new Date()) {
    return NextResponse.json(
      { error: "Link reset sudah kadaluarsa. Minta link baru." },
      { status: 400 }
    );
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      resetPasswordToken: null,
      resetPasswordTokenExpiry: null,
    },
  });

  return NextResponse.json({ ok: true });
}
