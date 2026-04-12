import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { seedDefaultCategories } from "@/utils/seed-categories";
import { generateVerificationToken, getTokenExpiry } from "@/lib/token-utils";
import { sendVerificationEmail } from "@/lib/email";

// POST /api/auth/register — daftar dengan email + password
export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "Nama, email, dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password minimal 8 karakter." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan login." },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);

    // Generate token verifikasi
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = getTokenExpiry();

    const user = await prisma.user.create({
      data: {
        email,
        name: name.trim(),
        password: hashed,
        verificationToken,
        verificationTokenExpiry,
        // emailVerified tetap null — belum diverifikasi
      },
    });

    // Seed kategori default (income + expense)
    await seedDefaultCategories(user.id);

    // Kirim email verifikasi (fire and forget — jangan block response)
    sendVerificationEmail(email, name.trim(), verificationToken).catch((err) =>
      console.error("[register] sendVerificationEmail error:", err)
    );

    return NextResponse.json({ message: "verification_sent" });
  } catch (error) {
    console.error("[register]", error);
    return NextResponse.json(
      { error: "Gagal mendaftar. Coba lagi." },
      { status: 500 }
    );
  }
}
