import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/is-admin";
import { Resend } from "resend";

// POST /api/admin/test-email
// Body: { to?: string }  (default: email admin yang login)
// Tools diagnostic untuk cek apakah RESEND_API_KEY production valid &
// domain BudgetIn bisa kirim. Hasil bisa: messageId (sukses) atau error Resend.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !isAdmin(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hasKey = !!process.env.RESEND_API_KEY;
  if (!hasKey) {
    return NextResponse.json(
      { ok: false, stage: "env", error: "RESEND_API_KEY tidak di-set di environment." },
      { status: 500 }
    );
  }

  let body: { to?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body kosong OK
  }
  const to = body.to?.trim() || session.user?.email;
  if (!to) {
    return NextResponse.json({ ok: false, stage: "input", error: "Email tujuan kosong." }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "BudgetIn <noreply@amuharr.com>",
    to,
    subject: "[BudgetIn] Test Email — Diagnostic",
    html: `<p>Halo,</p><p>Ini test email diagnostic dari admin panel BudgetIn.</p><p>Kalau kamu terima ini, artinya Resend API berfungsi normal di production.</p><p>Waktu kirim: ${new Date().toISOString()}</p>`,
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "resend",
        to,
        error: {
          name: error.name,
          message: error.message,
          raw: error,
        },
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, to, messageId: data?.id });
}
