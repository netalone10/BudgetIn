"use client";

import { useState } from "react";
import Link from "next/link";

type Existing = {
  id: string;
  approved: boolean;
  approvedAt: Date | null;
  createdAt: Date;
  quote: string;
  role: string;
  rating: number;
} | null;

const MIN_QUOTE = 30;
const MAX_QUOTE = 400;

export default function TestimoniForm({
  userName,
  existing,
}: {
  userName: string;
  existing: Existing;
}) {
  const hasActive = existing && existing.approved;
  const hasPending = existing && !existing.approved;

  const [quote, setQuote] = useState("");
  const [role, setRole] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const q = quote.trim();
    if (q.length < MIN_QUOTE) {
      setError(`Testimoni minimal ${MIN_QUOTE} karakter.`);
      return;
    }
    if (q.length > MAX_QUOTE) {
      setError(`Testimoni maksimal ${MAX_QUOTE} karakter.`);
      return;
    }
    if (role.trim().length < 3) {
      setError("Posisi/role minimal 3 karakter.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: q, role: role.trim(), rating }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Gagal kirim. Coba lagi.");
        return;
      }
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="testi-page">
      <style>{baseCss}</style>

      <header className="tp-nav">
        <Link href="/" className="tp-back">
          &larr; Kembali ke beranda
        </Link>
        <span className="tp-user">{userName}</span>
      </header>

      <main className="tp-main">
        <div className="tp-card">
          {success || hasPending ? (
            <SuccessState
              title={success ? "Terima kasih!" : "Testimoni kamu sedang direview"}
              description={
                success
                  ? "Testimoni kamu sudah kami terima dan masuk antrian review admin. Setelah disetujui, akan tampil di landing page BudgetIn."
                  : "Kamu sudah submit testimoni dan sedang menunggu review admin. Kami akan menampilkannya begitu disetujui."
              }
            />
          ) : hasActive ? (
            <SuccessState
              title="Testimoni kamu sudah tampil"
              description="Testimoni kamu sudah disetujui dan publish di landing. Kalau mau ganti, hubungi admin atau tunggu 24 jam untuk submit baru."
            />
          ) : (
            <>
              <div className="tp-head">
                <span className="tp-eyebrow">Tulis Testimoni</span>
                <h1>Cerita singkatmu, dampaknya besar.</h1>
                <p>
                  Bagikan bagaimana BudgetIn bantu kamu kelola keuangan. Setelah
                  di-review admin, testimoni kamu akan tampil di landing page.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="tp-form" noValidate>
                <label className="tp-field">
                  <span className="tp-label">Posisi &amp; kota</span>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Contoh: Marketing Staff, Jakarta"
                    maxLength={80}
                    required
                    disabled={submitting}
                  />
                  <span className="tp-help">
                    Ditampilkan di bawah namamu, biar relate sama pengunjung lain.
                  </span>
                </label>

                <label className="tp-field">
                  <span className="tp-label">Rating</span>
                  <div
                    className="tp-stars"
                    onMouseLeave={() => setHover(0)}
                    role="radiogroup"
                    aria-label="Rating"
                  >
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = (hover || rating) >= n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onMouseEnter={() => setHover(n)}
                          onClick={() => setRating(n)}
                          aria-checked={rating === n}
                          aria-label={`${n} bintang`}
                          role="radio"
                          className={active ? "active" : ""}
                          disabled={submitting}
                        >
                          {active ? "★" : "☆"}
                        </button>
                      );
                    })}
                    <span className="tp-rating-num">{rating} / 5</span>
                  </div>
                </label>

                <label className="tp-field">
                  <span className="tp-label">Testimoni kamu</span>
                  <textarea
                    value={quote}
                    onChange={(e) => setQuote(e.target.value)}
                    placeholder="Cerita singkat — apa yang berubah setelah pakai BudgetIn? Apa fitur favoritmu?"
                    rows={5}
                    maxLength={MAX_QUOTE + 50}
                    required
                    disabled={submitting}
                  />
                  <span className="tp-help">
                    {quote.trim().length} / {MAX_QUOTE} karakter · Minimal {MIN_QUOTE}.
                  </span>
                </label>

                {error && <div className="tp-error">{error}</div>}

                <div className="tp-actions">
                  <Link href="/" className="tp-btn tp-btn-ghost">
                    Batal
                  </Link>
                  <button
                    type="submit"
                    className="tp-btn tp-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Mengirim..." : "Kirim Testimoni"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        <p className="tp-foot">
          Testimoni kamu masuk antrian moderasi sebelum tampil ke publik.
          Cantumkan info yang nyaman kamu bagikan.
        </p>
      </main>
    </div>
  );
}

function SuccessState({ title, description }: { title: string; description: string }) {
  return (
    <div className="tp-success">
      <div className="tp-success-icon">✓</div>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link href="/" className="tp-btn tp-btn-primary">
        Kembali ke beranda
      </Link>
    </div>
  );
}

const baseCss = `
  .testi-page {
    --p: #d04f99; --p-dark: #a83880;
    --p-faint: rgba(208,79,153,0.07); --p-border: rgba(208,79,153,0.16);
    --bg: #fdfaf8; --bg-alt: #f6f0f4; --card: #ffffff;
    --fg: #1a1014; --fg2: #4a3a44; --fgm: #7c6e76; --fgf: #b0a0aa;
    --bd: rgba(0,0,0,0.07); --bds: rgba(0,0,0,0.11);
    --r: 16px; --rxl: 32px; --pill: 9999px;
    min-height: 100vh; background: var(--bg); color: var(--fg);
    font-family: var(--font-poppins), system-ui, sans-serif; font-size: 16px;
  }
  .testi-page *, .testi-page *::before, .testi-page *::after { box-sizing: border-box; }

  .tp-nav {
    max-width: 720px; margin: 0 auto; padding: 24px 24px 0;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
  }
  .tp-back { font-size: 14px; color: var(--fgm); text-decoration: none; }
  .tp-back:hover { color: var(--p); }
  .tp-user { font-size: 13px; color: var(--fgf); }

  .tp-main { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }

  .tp-card {
    background: var(--card); border: 1px solid var(--bd); border-radius: var(--rxl);
    box-shadow: 0 20px 60px rgba(0,0,0,0.09), 0 4px 16px rgba(0,0,0,0.05);
    padding: 48px 40px;
  }
  @media (max-width: 600px) { .tp-card { padding: 32px 22px; } }

  .tp-head { margin-bottom: 32px; }
  .tp-eyebrow {
    font-family: var(--font-fira-code), monospace; font-size: 11px; font-weight: 500;
    text-transform: uppercase; letter-spacing: 0.8px; color: var(--p);
    display: inline-block; margin-bottom: 14px;
  }
  .tp-head h1 {
    font-size: 32px; font-weight: 800; letter-spacing: -0.8px; line-height: 1.1;
    margin-bottom: 14px; color: var(--fg);
  }
  .tp-head p { font-size: 15px; color: var(--fgm); line-height: 1.7; }

  .tp-form { display: flex; flex-direction: column; gap: 24px; }
  .tp-field { display: flex; flex-direction: column; gap: 8px; }
  .tp-label { font-size: 13px; font-weight: 600; color: var(--fg2); }
  .tp-field input, .tp-field textarea {
    width: 100%; padding: 12px 14px; border-radius: var(--r);
    border: 1.5px solid var(--bds); background: var(--card); color: var(--fg);
    font-family: inherit; font-size: 15px; line-height: 1.55; resize: vertical;
    transition: border-color 0.15s;
  }
  .tp-field input:focus, .tp-field textarea:focus {
    outline: none; border-color: var(--p); box-shadow: 0 0 0 3px var(--p-faint);
  }
  .tp-help { font-size: 12px; color: var(--fgf); }

  .tp-stars { display: flex; align-items: center; gap: 4px; }
  .tp-stars button {
    border: none; background: none; cursor: pointer; padding: 4px 6px;
    font-size: 28px; color: var(--fgf); transition: color 0.15s, transform 0.15s;
  }
  .tp-stars button:hover { transform: scale(1.1); }
  .tp-stars button.active { color: #f59e0b; }
  .tp-stars button:disabled { cursor: not-allowed; opacity: 0.5; }
  .tp-rating-num { margin-left: 10px; font-size: 13px; color: var(--fgm); }

  .tp-error {
    padding: 10px 14px; background: #fef2f2; color: #c7312a;
    border: 1px solid #fecaca; border-radius: var(--r); font-size: 14px;
  }

  .tp-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
  .tp-btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 12px 24px; border-radius: var(--pill); font-size: 14px; font-weight: 600;
    cursor: pointer; transition: all 0.2s; text-decoration: none; border: 1.5px solid transparent;
  }
  .tp-btn-primary {
    background: var(--p); color: #fff; box-shadow: 0 8px 32px rgba(208,79,153,0.22);
  }
  .tp-btn-primary:hover { background: var(--p-dark); transform: translateY(-1px); }
  .tp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .tp-btn-ghost { color: var(--fg2); border-color: var(--bds); background: transparent; }
  .tp-btn-ghost:hover { background: var(--bg-alt); border-color: var(--p-border); color: var(--p); }

  .tp-foot { margin-top: 24px; font-size: 13px; color: var(--fgf); text-align: center; line-height: 1.7; }

  .tp-success { text-align: center; padding: 16px 4px; }
  .tp-success-icon {
    width: 64px; height: 64px; border-radius: 50%;
    background: var(--p); color: #fff; font-size: 30px; font-weight: 800;
    display: inline-flex; align-items: center; justify-content: center;
    margin-bottom: 22px; box-shadow: 0 8px 32px rgba(208,79,153,0.22);
  }
  .tp-success h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 14px; color: var(--fg); }
  .tp-success p { font-size: 15px; color: var(--fgm); line-height: 1.7; max-width: 460px; margin: 0 auto 28px; }
`;
