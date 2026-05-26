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
 * Blokir jika token dibuat < 1 menit lalu
 * (verificationTokenExpiry > now + 23j59m)
 */
export function canResendEmail(tokenExpiry: Date | null): boolean {
  if (!tokenExpiry) return true;
  const oneMinBuffer = 23 * 60 * 60 * 1000 + 59 * 60 * 1000; // 23h59m
  return tokenExpiry.getTime() <= Date.now() + oneMinBuffer;
}

/** Generate reset password token (64-char hex) */
export function generateResetPasswordToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Expiry: 1 jam dari sekarang */
export function getResetPasswordTokenExpiry(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

/**
 * Rate limit forgot password: true kalau boleh request lagi.
 * Blokir jika token dibuat < 1 menit lalu
 * (resetPasswordTokenExpiry > now + 59m)
 */
export function canRequestPasswordReset(tokenExpiry: Date | null): boolean {
  if (!tokenExpiry) return true;
  const oneMinBuffer = 59 * 60 * 1000; // 59m
  return tokenExpiry.getTime() <= Date.now() + oneMinBuffer;
}
