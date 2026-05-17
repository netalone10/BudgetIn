import { Resend } from "resend";
import crypto from "crypto";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { sanitizeName } from "./name-validation";

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
// HTML Escape Utility
// ---------------------------------------------------------------------------

/**
 * Escapes HTML special characters to prevent XSS and HTML injection
 * when interpolating user-generated content into HTML email templates.
 *
 * Escapes: < > & " '
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Resend SDK v3+ tidak throw error pada API failure — return { data, error }.
 * Wrapper ini ngubah error response jadi throw biar caller bisa pakai try/catch
 * dan fire-and-forget .catch() bisa fungsi seperti yg diharapkan.
 */
async function sendOrThrow(payload: Parameters<typeof resend.emails.send>[0]): Promise<string> {
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    const err = new Error(
      `[resend] ${error.name ?? "error"}: ${error.message ?? "unknown"}`
    );
    (err as Error & { resendError?: unknown }).resendError = error;
    throw err;
  }
  return data?.id ?? "";
}

/** Generate password baru: 12 char, huruf + angka */
export function generateRandomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(12))
    .map((b) => chars[b % chars.length])
    .join("");
}

// APP_URL: server-side only, tidak perlu NEXT_PUBLIC_
const APP_URL =
  process.env.APP_URL ??
  process.env.NEXTAUTH_URL ??
  "https://budget.amuharr.com";
const FROM = "BudgetIn <noreply@amuharr.com>";

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const link = `${APP_URL}/api/verify-email?token=${token}`;
  const safeName = escapeHtml(sanitizeName(name));

  await sendOrThrow({
    from: FROM,
    to,
    subject: "Verifikasi Email BudgetIn",
    html: `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:24px 32px;">
              <p style="margin:0;color:#f8fafc;font-size:20px;font-weight:700;letter-spacing:-0.5px;">BudgetIn</p>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Catat pengeluaranmu</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Hai, ${safeName}! 👋</p>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                Terima kasih sudah mendaftar di BudgetIn. Klik tombol di bawah untuk memverifikasi email kamu dan mulai mencatat keuangan.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#0f172a;border-radius:8px;">
                    <a href="${link}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                      Verifikasi Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
                Atau salin link ini ke browser kamu:
              </p>
              <p style="margin:0 0 24px;font-size:11px;color:#64748b;word-break:break-all;">
                <a href="${link}" style="color:#3b82f6;">${link}</a>
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px;">
                Link ini berlaku selama <strong>24 jam</strong>. Jika kamu tidak mendaftar di BudgetIn, abaikan email ini.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}

export async function sendRecurringReminderEmail(params: {
  to: string;
  name: string;
  type?: "expense" | "income" | "transfer";
  amount: number;
  dueDate: Date;
  daysUntil: number;
}): Promise<void> {
  const { to, name, type = "expense", amount, dueDate, daysUntil } = params;
  const dueDateStr = format(dueDate, "d MMMM yyyy", { locale: idLocale });
  const urgencyLabel = daysUntil === 1 ? "⚠️ Besok" : `⏰ ${daysUntil} hari lagi`;
  const typeLabel = type === "income" ? "pemasukan" : type === "transfer" ? "transfer" : "pembayaran";
  const subject = `[BudgetIn] ${name} jatuh tempo ${daysUntil === 1 ? "besok" : `dalam ${daysUntil} hari`}`;
  const safeBillName = escapeHtml(sanitizeName(name));

  await sendOrThrow({
    from: FROM,
    to,
    subject,
    html: `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="background:#0f172a;padding:24px 32px;">
              <p style="margin:0;color:#f8fafc;font-size:20px;font-weight:700;letter-spacing:-0.5px;">BudgetIn</p>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Pengingat ${typeLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Pengingat ${typeLabel === "pembayaran" ? "Pembayaran" : typeLabel === "pemasukan" ? "Pemasukan" : "Transfer"}</p>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                Item berulang kamu akan segera jatuh tempo:
              </p>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
                <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#0f172a;">${safeBillName}</p>
                <p style="margin:0 0 4px;font-size:14px;color:#475569;">Nominal: <strong>Rp ${amount.toLocaleString("id-ID")}</strong></p>
                <p style="margin:0 0 4px;font-size:14px;color:#475569;">Jatuh tempo: <strong>${dueDateStr}</strong></p>
                <p style="margin:0;font-size:14px;color:#dc2626;font-weight:600;">${urgencyLabel}</p>
              </div>
              ${type === "transfer" ? `
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#0f172a;border-radius:8px;">
                    <a href="${APP_URL}/dashboard/recurring" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                      Lihat Transfer
                    </a>
                  </td>
                </tr>
              </table>` : type === "income" ? `
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#0f172a;border-radius:8px;">
                    <a href="${APP_URL}/dashboard/recurring" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                      Lihat Detail
                    </a>
                  </td>
                </tr>
              </table>` : `
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#0f172a;border-radius:8px;">
                    <a href="${APP_URL}/dashboard/recurring" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                      Lihat Pengeluaran
                    </a>
                  </td>
                </tr>
              </table>`}
              <p style="margin:0;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px;">
                Email ini dikirim karena kamu mengaktifkan pengingat berulang di BudgetIn.
                <a href="${APP_URL}/dashboard/recurring" style="color:#3b82f6;">Kelola pengingat</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim(),
  });
}

export async function sendAutoRecordConfirmation(params: {
  to: string;
  name: string;
  type: "expense" | "income" | "transfer";
  amount: number;
  occurredAt: Date;
}): Promise<void> {
  const { to, name, type, amount, occurredAt } = params;
  const occurredStr = format(occurredAt, "d MMMM yyyy", { locale: idLocale });
  const typeLabel = type === "income" ? "Pemasukan" : type === "transfer" ? "Transfer" : "Pengeluaran";
  const headerLabel = type === "income" ? "Pemasukan Otomatis" : type === "transfer" ? "Transfer Otomatis" : "Pengeluaran Otomatis";
  const safeName = escapeHtml(sanitizeName(name));

  await sendOrThrow({
    from: FROM,
    to,
    subject: `[BudgetIn] ${name} (${typeLabel}) otomatis tercatat`,
    html: `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="background:#0f172a;padding:24px 32px;">
              <p style="margin:0;color:#f8fafc;font-size:20px;font-weight:700;letter-spacing:-0.5px;">BudgetIn</p>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Konfirmasi ${headerLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">${headerLabel} Berhasil ✅</p>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                Transaksi berikut telah otomatis dicatat oleh BudgetIn:
              </p>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
                <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#0f172a;">${safeName}</p>
                <p style="margin:0 0 4px;font-size:14px;color:#475569;">Tipe: <strong>${typeLabel}</strong></p>
                <p style="margin:0 0 4px;font-size:14px;color:#475569;">Nominal: <strong>Rp ${amount.toLocaleString("id-ID")}</strong></p>
                <p style="margin:0;font-size:14px;color:#475569;">Dicatat pada: <strong>${occurredStr}</strong></p>
              </div>
              <p style="margin:0;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px;">
                <a href="${APP_URL}/dashboard/recurring" style="color:#3b82f6;">Lihat semua transaksi berulang</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim(),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  newPassword: string
): Promise<void> {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://budget.amuharr.com"}/auth`;
  const safeName = escapeHtml(sanitizeName(name));

  await sendOrThrow({
    from: FROM,
    to,
    subject: "Password BudgetIn Kamu Direset",
    html: `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="background:#0f172a;padding:24px 32px;">
              <p style="margin:0;color:#f8fafc;font-size:20px;font-weight:700;letter-spacing:-0.5px;">BudgetIn</p>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Catat pengeluaranmu</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Halo, ${safeName}!</p>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                Password akun BudgetIn kamu telah direset oleh admin. Gunakan password sementara di bawah untuk login, lalu segera ganti password kamu.
              </p>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:0 0 24px;text-align:center;">
                <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Password Sementara</p>
                <p style="margin:0;font-size:24px;font-weight:700;color:#0f172a;letter-spacing:2px;font-family:monospace;">${newPassword}</p>
              </div>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#0f172a;border-radius:8px;">
                    <a href="${loginUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                      Login Sekarang
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px;">
                Jika kamu tidak meminta reset password, hubungi admin segera. Jangan bagikan password ini kepada siapapun.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
