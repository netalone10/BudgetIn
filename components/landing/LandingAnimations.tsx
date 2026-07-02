"use client";

/**
 * Client-side animations for the landing page.
 * Loaded via next/dynamic with { ssr: false } to keep the main page as a server component.
 * Handles: scroll reveal, hero chat loop, demo chat loop, budget bar fills.
 */

import { useEffect } from "react";

export default function LandingAnimations() {
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
    const root = document.querySelector(".landing-v2 .bw");
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
    const host = document.querySelector(".landing-v2 .hc-chat") as HTMLElement | null;
    if (!host) return;

    const HERO_CONVOS = [
      { user: "Ngopi sama croissant 42rb sebelum meeting", ai: "✓ Tersimpan — Rp 42.000 · Kopi & Jajan · Hari ini", ok: true },
      { user: "Isi bensin 150rb, sekalian tol 23rb", ai: "✓ 2 transaksi: Rp 150.000 + Rp 23.000 → Transport", ok: true },
      { user: "Sisa budget makan bulan ini?", ai: "Masih Rp 315.000 dari Rp 1.500.000 (79% terpakai)", ok: false },
    ];

    let idx = 0;
    let cancelled = false;
    const timers = new Set<number>();
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const t = window.setTimeout(() => { timers.delete(t); res(); }, ms);
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
      d.innerHTML = '<div class="cm-who">BudgetIn</div><div class="typing-dots"><span></span><span></span><span></span></div>';
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

    return () => { cancelled = true; timers.forEach((t) => window.clearTimeout(t)); };
  }, []);

  // Demo chat loop
  useEffect(() => {
    const dc = document.querySelector(".landing-v2 .dct-msgs") as HTMLElement | null;
    const dci = document.querySelector(".landing-v2 .dct-input") as HTMLElement | null;
    if (!dc || !dci) return;

    const DEMO_CONVOS = [
      { user: "Ngopi sama croissant 42rb sebelum meeting", ai: "✓ Rp 42.000 → Kopi & Jajan · Hari ini · BCA", ok: true },
      { user: "Isi bensin 150rb, sekalian tol 23rb", ai: "✓ 2 transaksi dicatat: Rp 150.000 + Rp 23.000 → Transport", ok: true },
      { user: "Transfer 500rb ke GoPay", ai: "✓ Transfer dicatat. BCA −Rp 500.000 · GoPay +Rp 500.000", ok: true },
      { user: "Sisa budget makan bulan ini berapa?", ai: "Masih Rp 315.000 dari Rp 1.500.000. Sudah 79% terpakai — hati-hati akhir bulan ya.", ok: false },
      { user: "Langganan Spotify 54rb", ai: "✓ Rp 54.000 → Tagihan & Langganan · Dicatat rutin tiap bulan", ok: true },
    ];

    let idx = 0;
    let cancelled = false;
    const timers = new Set<number>();
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const t = window.setTimeout(() => { timers.delete(t); res(); }, ms);
        timers.add(t);
      });

    const setInput = (html: string) => { dci.innerHTML = html; };
    const typeInput = (text: string) =>
      new Promise<void>((resolve) => {
        setInput('<span class="blink"></span>');
        let i = 0;
        const iv = window.setInterval(() => {
          if (cancelled) { window.clearInterval(iv); resolve(); return; }
          if (i < text.length) {
            i++;
            dci.textContent = text.slice(0, i);
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
    const trim = () => { while (dc.children.length > MAX_MSGS) dc.removeChild(dc.firstChild as Node); };

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
        td.innerHTML = '<div class="cm-who">BudgetIn</div><div class="typing-dots"><span></span><span></span><span></span></div>';
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

    return () => { cancelled = true; timers.forEach((t) => window.clearTimeout(t)); };
  }, []);

  return null;
}
