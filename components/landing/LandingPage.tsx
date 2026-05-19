"use client";

import { useEffect, useRef } from "react";
import "./landing.css";

type ChatMsg = { user: string; ai: string; ok: boolean };

const HERO_CONVOS: ChatMsg[] = [
  {
    user: "Ngopi sama croissant 42rb sebelum meeting",
    ai: "✓ Tersimpan — Rp 42.000 · Kopi & Jajan · Hari ini",
    ok: true,
  },
  {
    user: "Isi bensin 150rb, sekalian tol 23rb",
    ai: "✓ 2 transaksi: Rp 150.000 + Rp 23.000 → Transport",
    ok: true,
  },
  {
    user: "Sisa budget makan bulan ini?",
    ai: "Masih Rp 315.000 dari Rp 1.500.000 (79% terpakai)",
    ok: false,
  },
];

const DEMO_CONVOS: ChatMsg[] = [
  {
    user: "Ngopi sama croissant 42rb sebelum meeting",
    ai: "✓ Rp 42.000 → Kopi & Jajan · Hari ini · BCA",
    ok: true,
  },
  {
    user: "Isi bensin 150rb, sekalian tol 23rb",
    ai: "✓ 2 transaksi dicatat: Rp 150.000 + Rp 23.000 → Transport",
    ok: true,
  },
  {
    user: "Transfer 500rb ke GoPay",
    ai: "✓ Transfer dicatat. BCA −Rp 500.000 · GoPay +Rp 500.000",
    ok: true,
  },
  {
    user: "Sisa budget makan bulan ini berapa?",
    ai: "Masih Rp 315.000 dari Rp 1.500.000. Sudah 79% terpakai — hati-hati akhir bulan ya.",
    ok: false,
  },
  {
    user: "Langganan Spotify 54rb",
    ai: "✓ Rp 54.000 → Tagihan & Langganan · Dicatat rutin tiap bulan",
    ok: true,
  },
];

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

export default function LandingPage() {
  const heroChatRef = useRef<HTMLDivElement | null>(null);
  const demoChatRef = useRef<HTMLDivElement | null>(null);
  const demoInputRef = useRef<HTMLDivElement | null>(null);
  const budgetWidgetRef = useRef<HTMLDivElement | null>(null);

  // Scroll reveal
  useEffect(() => {
    const root = document.querySelector(".landing-v2");
    if (!root) return;
    const reveal = (el: Element) => el.classList.add("in");
    const inView = (el: Element) =>
      el.getBoundingClientRect().top < window.innerHeight * 1.1;
    root.querySelectorAll(".rv").forEach((el) => {
      if (inView(el)) reveal(el);
    });
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            reveal(e.target);
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    root.querySelectorAll(".rv").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Hero budget bars fill
  useEffect(() => {
    const id = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".landing-v2 .hc-bfill").forEach((el) => {
        const pct = Math.min(Number(el.dataset.pct) || 0, 100);
        el.style.width = pct + "%";
      });
    }, 400);
    return () => window.clearTimeout(id);
  }, []);

  // Budget widget bars on scroll
  useEffect(() => {
    const root = budgetWidgetRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.querySelectorAll<HTMLElement>(".bw-fill").forEach((bar) => {
            const pct = Math.min(Number(bar.dataset.pct) || 0, 100);
            window.setTimeout(() => {
              bar.style.width = pct + "%";
            }, 100);
          });
          obs.unobserve(e.target);
        });
      },
      { threshold: 0.2 }
    );
    obs.observe(root);
    return () => obs.disconnect();
  }, []);

  // Hero chat loop
  useEffect(() => {
    const host = heroChatRef.current;
    if (!host) return;
    let idx = 0;
    let cancelled = false;
    const timers = new Set<number>();
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const t = window.setTimeout(() => {
          timers.delete(t);
          res();
        }, ms);
        timers.add(t);
      });

    const addMsg = (who: "u" | "a", text: string, isOk: boolean) => {
      const div = document.createElement("div");
      div.className = "cm " + who;
      const lbl = who === "u" ? "Kamu" : "BudgetIn";
      const bubCls = who === "a" && isOk ? "cm-bub ok" : "cm-bub";
      div.innerHTML = `<div class="cm-who">${lbl}</div><div class="${bubCls}"></div>`;
      const bub = div.querySelector(".cm-bub");
      if (bub) bub.textContent = text;
      host.appendChild(div);
      host.scrollTop = host.scrollHeight;
    };
    const addTyping = () => {
      const d = document.createElement("div");
      d.className = "cm a";
      d.innerHTML =
        '<div class="cm-who">BudgetIn</div><div class="typing-dots"><span></span><span></span><span></span></div>';
      host.appendChild(d);
      host.scrollTop = host.scrollHeight;
      return d;
    };

    (async function loop() {
      while (!cancelled) {
        host.innerHTML = "";
        const c = HERO_CONVOS[idx % HERO_CONVOS.length];
        idx++;
        await wait(300);
        if (cancelled) return;
        addMsg("u", c.user, false);
        const t = addTyping();
        await wait(1100);
        if (cancelled) return;
        t.remove();
        addMsg("a", c.ai, c.ok);
        await wait(2800);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Demo chat loop (with typing effect on input)
  useEffect(() => {
    const dc = demoChatRef.current;
    const dci = demoInputRef.current;
    if (!dc || !dci) return;
    let idx = 0;
    let cancelled = false;
    const timers = new Set<number>();
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const t = window.setTimeout(() => {
          timers.delete(t);
          res();
        }, ms);
        timers.add(t);
      });

    const setInput = (html: string) => {
      dci.innerHTML = html;
    };
    const typeInput = (text: string) =>
      new Promise<void>((resolve) => {
        setInput('<span class="blink"></span>');
        let i = 0;
        const iv = window.setInterval(() => {
          if (cancelled) {
            window.clearInterval(iv);
            resolve();
            return;
          }
          if (i < text.length) {
            i++;
            const slice = text.slice(0, i);
            dci.textContent = slice;
            const blink = document.createElement("span");
            blink.className = "blink";
            dci.appendChild(blink);
          } else {
            window.clearInterval(iv);
            window.setTimeout(resolve, 300);
          }
        }, 42);
      });

    const MAX_MSGS = 6;
    const trim = () => {
      while (dc.children.length > MAX_MSGS) {
        dc.removeChild(dc.firstChild as Node);
      }
    };

    (async function loop() {
      await wait(800);
      while (!cancelled) {
        const c = DEMO_CONVOS[idx % DEMO_CONVOS.length];
        idx++;
        await typeInput(c.user);
        if (cancelled) return;
        setInput('Ketik transaksimu di sini...<span class="blink"></span>');

        trim();
        const um = document.createElement("div");
        um.className = "cm u";
        um.innerHTML = '<div class="cm-who">Kamu</div><div class="cm-bub"></div>';
        const ub = um.querySelector(".cm-bub");
        if (ub) ub.textContent = c.user;
        dc.appendChild(um);
        dc.scrollTop = dc.scrollHeight;

        await wait(300);
        if (cancelled) return;
        const td = document.createElement("div");
        td.className = "cm a";
        td.innerHTML =
          '<div class="cm-who">BudgetIn</div><div class="typing-dots"><span></span><span></span><span></span></div>';
        dc.appendChild(td);
        dc.scrollTop = dc.scrollHeight;

        await wait(900);
        if (cancelled) return;
        td.remove();
        const am = document.createElement("div");
        am.className = "cm a";
        const bubCls = c.ok ? "cm-bub ok" : "cm-bub";
        am.innerHTML = `<div class="cm-who">BudgetIn</div><div class="${bubCls}"></div>`;
        const ab = am.querySelector(".cm-bub");
        if (ab) ab.textContent = c.ai;
        dc.appendChild(am);
        dc.scrollTop = dc.scrollHeight;

        await wait(2400);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

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
            <a href="/auth" className="nav-sign">
              Masuk
            </a>
            <a href="/auth" className="btn btn-primary btn-sm">
              Mulai Gratis
            </a>
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
              <a href="/auth" className="btn btn-primary">
                Mulai Gratis &rarr;
              </a>
              <a href="/auth?demo=1" className="btn btn-outline">
                Coba Demo Dulu
              </a>
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

            <div className="hc-chat" ref={heroChatRef} />

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
            <div className="stat-n">10.000+</div>
            <div className="stat-l">Pengguna Aktif</div>
          </div>
          <div className="stat">
            <div className="stat-n">500.000+</div>
            <div className="stat-l">Transaksi Dicatat</div>
          </div>
          <div className="stat">
            <div className="stat-n">4,8 / 5,0</div>
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
              <div className="dct-msgs" ref={demoChatRef} />
              <div className="dct-input-bar">
                <div className="dct-input" ref={demoInputRef}>
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
          <div className="bw rv" ref={budgetWidgetRef}>
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
            <h2>Dipercaya ribuan anak muda Indonesia.</h2>
          </div>
          <div className="testi-grid">
            <div className="tc rv d1">
              <div className="tc-stars">
                <span>&#9733;</span>
                <span>&#9733;</span>
                <span>&#9733;</span>
                <span>&#9733;</span>
                <span>&#9733;</span>
              </div>
              <p className="tc-q">
                &ldquo;Dulu gajian langsung habis gak jelas. Sekarang aku tahu persis ke
                mana aja uangku pergi &mdash; dan mulai bisa nabung.&rdquo;
              </p>
              <div className="tc-author">
                <div className="tc-av" style={{ background: "#d04f99" }}>R</div>
                <div>
                  <div className="tc-name">Rina, 26</div>
                  <div className="tc-role">Marketing Staff, Jakarta</div>
                </div>
              </div>
            </div>
            <div className="tc rv d2">
              <div className="tc-stars">
                <span>&#9733;</span>
                <span>&#9733;</span>
                <span>&#9733;</span>
                <span>&#9733;</span>
                <span>&#9733;</span>
              </div>
              <p className="tc-q">
                &ldquo;Fitur budget vs realisasi bikin aku sadar pengeluaran makan di
                luar over budget tiap bulan. Akhirnya bisa koreksi.&rdquo;
              </p>
              <div className="tc-author">
                <div className="tc-av" style={{ background: "#6366f1" }}>D</div>
                <div>
                  <div className="tc-name">Dimas, 29</div>
                  <div className="tc-role">Software Engineer, Bandung</div>
                </div>
              </div>
            </div>
            <div className="tc rv d3">
              <div className="tc-stars">
                <span>&#9733;</span>
                <span>&#9733;</span>
                <span>&#9733;</span>
                <span>&#9733;</span>
                <span>&#9733;</span>
              </div>
              <p className="tc-q">
                &ldquo;Akhirnya nemu app yang ngerti kalau transfer GoPay itu bukan
                pengeluaran. Laporan jadi bersih dan akurat.&rdquo;
              </p>
              <div className="tc-author">
                <div className="tc-av" style={{ background: "#0ea5b4" }}>S</div>
                <div>
                  <div className="tc-name">Sari, 24</div>
                  <div className="tc-role">Freelance Designer, Surabaya</div>
                </div>
              </div>
            </div>
          </div>
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
            <a href="/auth" className="btn-white btn">
              Mulai Gratis Sekarang &rarr;
            </a>
            <a href="/auth?demo=1" className="btn-wghost btn">
              Coba Demo Dulu
            </a>
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
            <a href="/about">Tentang</a>
            <a href="/contact">Kontak</a>
            <a href="/privacy">Kebijakan Privasi</a>
            <a href="/terms">Syarat & Ketentuan</a>
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
