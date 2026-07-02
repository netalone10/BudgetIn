import Link from "next/link";
import "./landing.css";

export type LandingStats = {
  userCountLabel: string;
  transactionCountLabel: string;
  ratingLabel: string;
};

export type LandingTestimonial = {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  avatarBg: string;
};

type BudgetRow = {
  cat: string;
  icon: string;
  bg: string;
  pct: number;
  status: "safe" | "warn" | "over";
  budget: string;
  actual: string;
};

const BUDGET_DATA: BudgetRow[] = [
  { cat: "Makan & Minum", icon: "🍽", bg: "#fff0f0", pct: 79, status: "warn", budget: "1.500.000", actual: "1.185.000" },
  { cat: "Transport", icon: "🚗", bg: "#eff6ff", pct: 55, status: "safe", budget: "600.000", actual: "330.000" },
  { cat: "Tagihan", icon: "⚡", bg: "#f0fdf4", pct: 92, status: "warn", budget: "1.000.000", actual: "920.000" },
  { cat: "Kopi & Jajan", icon: "☕", bg: "#fff7ed", pct: 118, status: "over", budget: "300.000", actual: "354.000" },
  { cat: "Hiburan", icon: "🎮", bg: "#faf5ff", pct: 40, status: "safe", budget: "500.000", actual: "200.000" },
  { cat: "Belanja", icon: "🛒", bg: "#fffbeb", pct: 67, status: "safe", budget: "600.000", actual: "402.000" },
];

const STATUS_LABEL: Record<BudgetRow["status"], string> = {
  safe: "Aman",
  warn: "Hampir Limit",
  over: "Over Budget",
};

const LogoMark = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M4 14V4h3.5a4.5 4.5 0 0 1 0 9H4z" fill="white" opacity=".95" />
    <circle cx="13.5" cy="9" r="2.5" fill="white" opacity=".55" />
  </svg>
);

type Props = {
  stats: LandingStats;
  testimonials: LandingTestimonial[];
};

function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed[0].toUpperCase();
}

function Stars({ count }: { count: number }) {
  const safe = Math.max(0, Math.min(5, count));
  return (
    <div className="tc-stars">
      {Array.from({ length: safe }).map((_, i) => (
        <span key={i}>&#9733;</span>
      ))}
    </div>
  );
}

export default function LandingPage({ stats, testimonials }: Props) {
  const hasTestimonials = testimonials.length > 0;

  return (
    <div className="landing-v2">
      {/* ── NAV ── */}
      <nav className="lv2-nav">
        <div className="wrap nav-inner">
          <a href="#" className="nav-logo">
            <div className="nav-logo-mark">
              <LogoMark size={18} />
            </div>
            BudgetIn
          </a>
          <div className="nav-links">
            <a href="#fitur">Fitur</a>
            <a href="#demo">Demo</a>
            <a href="#cara-kerja">Cara Kerja</a>
          </div>
          <div className="nav-right">
            <Link href="/auth" className="nav-sign">
              Masuk
            </Link>
            <Link href="/auth" className="btn btn-primary btn-sm">
              Mulai Gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="wrap hero-inner">
          <div className="hero-text">
            <div className="hero-pill">
              <span className="dot" />
              AI parsing aktif &middot; Bahasa Indonesia
            </div>
            <h1 className="hero-h1">
              Catat pengeluaran
              <br />
              <em>seperti kirim pesan.</em>
            </h1>
            <p className="hero-sub">
              Tulis &ldquo;ngopi 42rb&rdquo; dan BudgetIn langsung tangkap nominalnya,
              pilihkan kategori, susun jadi laporan keuangan yang rapi &mdash; tanpa
              form kaku.
            </p>
            <div className="hero-ctas">
              <Link href="/auth" className="btn btn-primary">
                Mulai Gratis &rarr;
              </Link>
              <Link href="/auth?demo=1" className="btn btn-outline">
                Coba Demo Dulu
              </Link>
            </div>
            <div className="hero-trust">
              <span>
                <span className="ck">&#10003;</span> Gratis
              </span>
              <span>
                <span className="ck">&#10003;</span> Tanpa kartu kredit
              </span>
              <span>
                <span className="ck">&#10003;</span> Login Google/Email
              </span>
            </div>
          </div>

          <div className="hero-card">
            <div className="hc-topbar">
              <div className="hc-topbar-left">
                <div className="hc-avatar">
                  <LogoMark size={14} />
                </div>
                <div>
                  <div className="hc-title">BudgetIn AI</div>
                  <div className="hc-sub">Inbox transaksi</div>
                </div>
              </div>
              <div className="hc-live">
                <div className="hc-live-dot" />
                Live parsing
              </div>
            </div>

            <div className="hc-chat" />

            <div className="hc-budget">
              <div className="hc-budget-title">Status Budget &middot; Mei 2026</div>
              <div className="hc-brow">
                <div className="hc-blabel">Makan</div>
                <div className="hc-btrack">
                  <div className="hc-bfill" data-pct="79" style={{ background: "#f59e0b" }} />
                </div>
                <div className="hc-bpct">79%</div>
              </div>
              <div className="hc-brow">
                <div className="hc-blabel">Transport</div>
                <div className="hc-btrack">
                  <div className="hc-bfill" data-pct="45" style={{ background: "#22c55e" }} />
                </div>
                <div className="hc-bpct">45%</div>
              </div>
              <div className="hc-brow">
                <div className="hc-blabel">Tagihan</div>
                <div className="hc-btrack">
                  <div className="hc-bfill" data-pct="92" style={{ background: "#f59e0b" }} />
                </div>
                <div className="hc-bpct">92%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="stats rv">
        <div className="wrap stats-row">
          <div className="stat">
            <div className="stat-n">{stats.userCountLabel}</div>
            <div className="stat-l">Pengguna Aktif</div>
          </div>
          <div className="stat">
            <div className="stat-n">{stats.transactionCountLabel}</div>
            <div className="stat-l">Transaksi Dicatat</div>
          </div>
          <div className="stat">
            <div className="stat-n">{stats.ratingLabel}</div>
            <div className="stat-l">Rating Pengguna</div>
          </div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section className="features" id="fitur">
        <div className="wrap">
          <div className="sh rv">
            <span className="label">Fitur Utama</span>
            <h2>
              Dirancang untuk yang
              <br />
              tidak mau ribet.
            </h2>
            <p>
              Dari input hingga insight, semua alurnya dibuat sesederhana mungkin tanpa
              mengorbankan akurasi.
            </p>
          </div>

          <div className="feat-grid">
            <div className="fc wide rv">
              <div>
                <div className="fi" style={{ background: "rgba(208,79,153,0.1)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d04f99" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <span className="label">Input Natural</span>
                <h3>Ketik seperti chat biasa.</h3>
                <p>
                  Tidak ada form kaku. Tidak ada dropdown panjang. Tulis saja &mdash;
                  BudgetIn tangkap nominal, kategori, dan konteksnya secara otomatis.
                </p>
              </div>
              <div className="feat-chat">
                <div className="feat-chat-row">
                  <div className="fca u">K</div>
                  <div className="fct">Ngopi sama croissant 42rb sebelum meeting</div>
                </div>
                <div className="feat-chat-row">
                  <div className="fca a">AI</div>
                  <div>
                    <div className="fct">
                      <strong>&#10003; Tersimpan</strong> &mdash; Rp 42.000 &middot; Hari ini
                    </div>
                    <div className="fc-tag">{"☕"} Kopi & Jajan</div>
                  </div>
                </div>
                <div className="feat-chat-row">
                  <div className="fca u">K</div>
                  <div className="fct">Isi bensin 150rb, sekalian tol 23rb</div>
                </div>
                <div className="feat-chat-row">
                  <div className="fca a">AI</div>
                  <div>
                    <div className="fct">
                      <strong>&#10003; 2 transaksi dicatat</strong> &mdash; Rp 150.000 + Rp 23.000
                    </div>
                    <div className="fc-tag">{"🚗"} Transport</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="fc rv d1">
              <div className="fi" style={{ background: "rgba(245,158,11,0.1)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <span className="label">Budget Kategori</span>
              <h3>Tahu sebelum kebobolan.</h3>
              <p>
                Set batas per kategori, pantau real-time. Tidak perlu nunggu akhir bulan
                untuk sadar sudah overspending.
              </p>
            </div>

            <div className="fc rv d2">
              <div className="fi" style={{ background: "rgba(99,102,241,0.1)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
              <span className="label">AI Insight</span>
              <h3>Ringkasan yang langsung bisa dipakai.</h3>
              <p>
                Bukan sekadar angka. Kamu dapat summary singkat dan saran konkret tiap
                bulan dari pola pengeluaranmu.
              </p>
            </div>

            <div
              className="fc rv d3"
              style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 36 }}
            >
              <div className="fi" style={{ background: "rgba(34,197,94,0.1)", flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              </div>
              <div>
                <span className="label">Data Milikmu</span>
                <h3 style={{ marginTop: 10 }}>
                  Tersimpan di Google Sheets kamu &mdash; bukan server kami.
                </h3>
                <p>
                  BudgetIn bekerja di atas spreadsheet Google akunmu sendiri. Data tetap
                  sepenuhnya milikmu, bisa diakses kapan saja, dan tidak akan hilang.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMO ── */}
      <section className="demo" id="demo">
        <div className="wrap">
          <div className="sh rv">
            <span className="label">Lihat Langsung</span>
            <h2>Begini rasanya dalam 60 detik.</h2>
            <p>
              Tidak perlu daftar dulu. Lihat bagaimana BudgetIn mengurai teks biasa jadi
              data keuangan yang rapi.
            </p>
          </div>

          <div className="demo-inner">
            <div className="demo-chat-wrap rv">
              <div className="dct-bar">
                <div className="dct-dots">
                  <div className="dct-dot" style={{ background: "#ff5f57" }} />
                  <div className="dct-dot" style={{ background: "#ffbd2e" }} />
                  <div className="dct-dot" style={{ background: "#28c840" }} />
                </div>
                <div className="dct-title">BudgetIn &mdash; Inbox Transaksi</div>
                <div className="dct-badge">AI Aktif</div>
              </div>
              <div className="dct-msgs" />
              <div className="dct-input-bar">
                <div className="dct-input">
                  Ketik transaksimu di sini...
                  <span className="blink" />
                </div>
                <div className="dct-send">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="demo-results rv d1">
              <div className="dr">
                <div className="dr-lbl">Transaksi Terakhir Diparse</div>
                <div className="dr-amt">Rp 42.000</div>
                <div className="dr-chips">
                  <span className="chip chip-p">{"☕"} Kopi & Jajan</span>
                  <span className="chip chip-n">{"📅"} Hari ini</span>
                  <span className="chip chip-g">&#10003; Tersimpan</span>
                </div>
              </div>
              <div className="dr">
                <div className="dr-lbl">Insight Hari Ini</div>
                <div className="dr-insight">
                  <div className="dr-insight-lbl">AI Summary</div>
                  <p>
                    Pengeluaran makan minggu ini sudah <strong>Rp 285.000</strong> &mdash;
                    naik 34% dari minggu lalu. Coba batasi jajan siang sampai Jumat.
                  </p>
                </div>
              </div>
              <div className="dr">
                <div className="dr-lbl">Budget Bulan Ini</div>
                <div className="dr-amt" style={{ fontSize: 22, marginBottom: 14 }}>
                  Rp 1.215.000{" "}
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--fgm)" }}>
                    terpakai
                  </span>
                </div>
                <div className="dr-chips">
                  <span className="chip chip-n">dari Rp 4.500.000</span>
                  <span
                    className="chip"
                    style={{ background: "#e8faf1", color: "#0d8042", border: "1px solid #b6f0d2" }}
                  >
                    27% terpakai
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BUDGET WIDGET ── */}
      <section className="budget" id="budget">
        <div className="wrap">
          <div className="sh rv">
            <span className="label">Budget Tracker</span>
            <h2>Semua kategori, satu pandangan.</h2>
            <p>
              Pantau progress budget per kategori secara real-time. Tahu mana yang aman,
              mana yang harus dijaga.
            </p>
          </div>
          <div className="bw rv">
            <div className="bw-header">
              <h3>Status Budget Bulan Ini</h3>
              <span>Mei 2026</span>
            </div>
            <div className="bw-rows">
              {BUDGET_DATA.map((d) => (
                <div key={d.cat} className="bw-row">
                  <div className="bw-icon" style={{ background: d.bg }}>
                    {d.icon}
                  </div>
                  <div className="bw-info">
                    <div className="bw-name">{d.cat}</div>
                    <div className="bw-amts">
                      Rp {d.actual} dari Rp {d.budget}
                    </div>
                    <div className="bw-track">
                      <div className={`bw-fill b-${d.status}`} data-pct={d.pct} />
                    </div>
                  </div>
                  <div className="bw-right">
                    <div className={`bw-pct p-${d.status}`}>{d.pct}%</div>
                    <div className={`bw-tag s-${d.status}`}>{STATUS_LABEL[d.status]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="how" id="cara-kerja">
        <div className="wrap">
          <div className="sh rv">
            <span className="label">Cara Kerja</span>
            <h2>Mulai dalam 3 langkah.</h2>
            <p>
              Tidak ada setup ribet. Tidak ada migrasi data. Langsung pakai dalam hitungan menit.
            </p>
          </div>
          <div className="steps">
            <div className="step rv d1">
              <div className="step-n">1</div>
              <h3>Daftar Gratis</h3>
              <p>
                Login dengan Google atau buat akun email. Tidak perlu kartu kredit &mdash;
                30 detik dan kamu sudah di dalam.
              </p>
            </div>
            <div className="step rv d2">
              <div className="step-n">2</div>
              <h3>Catat Transaksi</h3>
              <p>
                Ketik natural seperti chat biasa, atau isi form manual untuk kontrol penuh.
                Keduanya sama cepatnya.
              </p>
            </div>
            <div className="step rv d3">
              <div className="step-n">3</div>
              <h3>Pahami & Kontrol</h3>
              <p>
                Dashboard, laporan, dan AI insight langsung tersedia. Kamu tahu persis
                kondisi keuanganmu kapan saja.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="testi">
        <div className="wrap">
          <div className="sh rv">
            <span className="label">Dari Pengguna</span>
            <h2>
              {hasTestimonials
                ? "Cerita nyata dari pengguna BudgetIn."
                : "Jadilah yang pertama bagikan ceritamu."}
            </h2>
            {!hasTestimonials && (
              <p>
                Belum ada testimoni publik. Kalau BudgetIn sudah bantu kamu, cerita
                singkatmu bisa jadi alasan teman lain mulai juga.
              </p>
            )}
          </div>

          {hasTestimonials ? (
            <>
              <div className="testi-grid">
                {testimonials.map((t, idx) => (
                  <div key={t.id} className={`tc rv d${(idx % 3) + 1}`}>
                    <Stars count={t.rating} />
                    <p className="tc-q">&ldquo;{t.quote}&rdquo;</p>
                    <div className="tc-author">
                      <div className="tc-av" style={{ background: t.avatarBg }}>
                        {getInitial(t.name)}
                      </div>
                      <div>
                        <div className="tc-name">{t.name}</div>
                        <div className="tc-role">{t.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="testi-cta rv">
                <p>Punya pengalaman pakai BudgetIn? Bagikan ceritamu.</p>
                <Link href="/testimoni" className="btn btn-primary">
                  Tulis Testimoni &rarr;
                </Link>
              </div>
            </>
          ) : (
            <div className="testi-empty rv">
              <div className="testi-empty-icon" aria-hidden="true">{"💬"}</div>
              <h3>Tulis testimoni pertamamu</h3>
              <p>
                Cerita singkat — 1-2 kalimat — tentang bagaimana BudgetIn membantu
                kamu. Setelah di-review admin, kamu akan tampil di sini.
              </p>
              <Link href="/testimoni" className="btn btn-primary">
                Tulis Testimoni Pertama &rarr;
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── COMING SOON ── */}
      <section className="coming">
        <div className="wrap">
          <div className="sh rv">
            <span className="label">Yang Akan Datang</span>
            <h2>BudgetIn terus berkembang.</h2>
            <p>
              Fitur-fitur berikut sedang dalam pengembangan aktif. Daftar sekarang dan
              kamu akan jadi yang pertama dapat akses.
            </p>
          </div>
          <div className="coming-grid">
            <div className="cc rv d1">
              <div className="cc-icon">{"📊"}</div>
              <h3>Export CSV & PDF</h3>
              <p>
                Download laporan transaksi dan ringkasan budget dalam format yang bisa
                dibuka di mana saja.
              </p>
            </div>
            <div className="cc rv d2">
              <div className="cc-icon">{"🔔"}</div>
              <h3>Alert Budget Otomatis</h3>
              <p>
                Notifikasi otomatis saat budget kategori hampir habis &mdash; sebelum
                kamu kebobolan.
              </p>
            </div>
            <div className="cc rv d3">
              <div className="cc-icon">{"🏦"}</div>
              <h3>Import Rekening Bank</h3>
              <p>
                Upload mutasi rekening bank atau e-wallet, BudgetIn parse dan
                kategorikan otomatis.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── DARK CTA ── */}
      <section className="cta-dark">
        <div className="wrap">
          <span className="label">Mulai Sekarang</span>
          <h2>
            Keuanganmu lebih tenang,
            <br />
            <em>mulai hari ini.</em>
          </h2>
          <p>
            Bergabung dengan ribuan anak muda Indonesia yang sudah lebih terkontrol soal
            uang &mdash; gratis, tanpa ribet.
          </p>
          <div className="cta-btns">
            <Link href="/auth" className="btn-white btn">
              Mulai Gratis Sekarang &rarr;
            </Link>
            <Link href="/auth?demo=1" className="btn-wghost btn">
              Coba Demo Dulu
            </Link>
          </div>
          <div className="cta-tags">
            <span>Gratis selamanya</span>
            <span>Tanpa kartu kredit</span>
            <span>Data milikmu</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lv2-foot">
        <div className="wrap foot-inner">
          <div className="foot-logo">BudgetIn</div>
          <div className="foot-links">
            <Link href="/about">Tentang</Link>
            <Link href="/contact">Kontak</Link>
            <Link href="/privacy">Kebijakan Privasi</Link>
            <Link href="/terms">Syarat &amp; Ketentuan</Link>
          </div>
          <div className="foot-copy">
            &copy; 2026 BudgetIn &middot; Dibuat oleh{" "}
            <a href="https://amuharr.com" style={{ color: "var(--p)" }}>
              Akbar Muharram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
