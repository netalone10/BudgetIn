import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://budget.amuharr.com";
const FROM = "BudgetIn <noreply@amuharr.com>";

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const link = `${APP_URL}/auth/verify?token=${token}`;

  await resend.emails.send({
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
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Hai, ${name}! 👋</p>
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
