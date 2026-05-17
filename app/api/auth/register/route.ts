import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { seedDefaultCategories } from "@/utils/seed-categories";
import { generateVerificationToken, getTokenExpiry } from "@/lib/token-utils";
import { sendVerificationEmail } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";
import { evaluatePassword } from "@/lib/password-strength";
import { validateName } from "@/lib/name-validation";

// POST /api/auth/register — daftar dengan email + password
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, turnstileToken } = await req.json();

    // Verifikasi Cloudflare Turnstile CAPTCHA
    const captchaOk = await verifyTurnstile(turnstileToken);
    if (!captchaOk) {
      return NextResponse.json(
        { error: "Verifikasi CAPTCHA gagal. Coba lagi." },
        { status: 400 }
      );
    }

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "Nama, email, dan password wajib diisi." },
        { status: 400 }
      );
    }

    // Validate name: reject URLs, HTML tags, and suspicious domain patterns
    const nameValidation = validateName(name.trim());
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      );
    }

    const strength = evaluatePassword(password);
    if (!strength.acceptable) {
      const missing = strength.checks
        .filter((c) => c.required && !c.passed)
        .map((c) => c.label.toLowerCase())
        .join(", ");
      return NextResponse.json(
        { error: `Password belum memenuhi syarat: ${missing}.` },
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

    // Kirim email verifikasi — tunggu hasilnya, kalau gagal rollback user
    // biar pendaftar bisa retry tanpa stuck di 409 conflict.
    try {
      await sendVerificationEmail(email, name.trim(), verificationToken);
    } catch (err) {
      const e = err as Error & { resendError?: unknown };
      console.error("[register] sendVerificationEmail FAILED", {
        to: email,
        userId: user.id,
        message: e?.message,
        name: e?.name,
        resendError: e?.resendError,
      });
      // Rollback: hapus user supaya bisa daftar ulang
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      return NextResponse.json(
        {
          error:
            "Akun belum bisa dibuat karena email verifikasi gagal terkirim. Coba lagi beberapa menit lagi atau hubungi admin.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: "verification_sent" });
  } catch (error) {
    console.error("[register]", error);
    return NextResponse.json(
      { error: "Gagal mendaftar. Coba lagi." },
      { status: 500 }
    );
  }
}
