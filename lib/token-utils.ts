import crypto from "crypto";

/** Generate 64-char hex token — tidak butuh library tambahan */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Expiry: 24 jam dari sekarang */
export function getTokenExpiry(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

/**
 * Rate limit resend: true kalau boleh kirim ulang.
 * Blokir jika token dibuat < 5 menit lalu
 * (verificationTokenExpiry > now + 23j55m)
 */
export function canResendEmail(tokenExpiry: Date | null): boolean {
  if (!tokenExpiry) return true;
  const fiveMinBuffer = 23 * 60 * 60 * 1000 + 55 * 60 * 1000; // 23h55m
  return tokenExpiry.getTime() <= Date.now() + fiveMinBuffer;
}
