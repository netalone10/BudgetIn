import {
  advanceDate,
  calcNextOccurrence,
  occurrenceKey,
  describeFrequency,
  RECURRING_FREQUENCIES,
  RECURRING_TYPES,
} from "@/utils/recurring-utils";

// ── advanceDate ───────────────────────────────────────────────────────────────

describe("advanceDate", () => {
  const base = new Date("2026-01-15T00:00:00Z");

  it("daily: maju N hari", () => {
    expect(advanceDate(base, "daily", 1).toISOString().slice(0, 10)).toBe("2026-01-16");
    expect(advanceDate(base, "daily", 7).toISOString().slice(0, 10)).toBe("2026-01-22");
  });

  it("weekly: maju N minggu", () => {
    expect(advanceDate(base, "weekly", 1).toISOString().slice(0, 10)).toBe("2026-01-22");
    expect(advanceDate(base, "weekly", 2).toISOString().slice(0, 10)).toBe("2026-01-29");
  });

  it("monthly: maju N bulan", () => {
    expect(advanceDate(base, "monthly", 1).toISOString().slice(0, 10)).toBe("2026-02-15");
    expect(advanceDate(base, "monthly", 3).toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("yearly: maju N tahun", () => {
    expect(advanceDate(base, "yearly", 1).toISOString().slice(0, 10)).toBe("2027-01-15");
  });

  it("monthly: clamp ke akhir bulan (31 Jan → 28/29 Feb)", () => {
    const jan31 = new Date("2026-01-31T00:00:00Z");
    const result = advanceDate(jan31, "monthly", 1);
    expect(result.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("interval 0 diperlakukan sebagai 1", () => {
    const r = advanceDate(base, "daily", 0);
    expect(r.toISOString().slice(0, 10)).toBe("2026-01-16");
  });
});

// ── calcNextOccurrence ────────────────────────────────────────────────────────

describe("calcNextOccurrence", () => {
  it("startDate di masa depan langsung dikembalikan", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = calcNextOccurrence("monthly", 1, future);
    expect(result.getTime()).toBe(future.getTime());
  });

  it("startDate di masa lalu: maju sampai lebih dari from", () => {
    const past = new Date("2025-01-01T00:00:00Z");
    const from = new Date("2026-01-01T00:00:00Z");
    const result = calcNextOccurrence("monthly", 1, past, from);
    expect(result > from).toBe(true);
  });

  it("hasil selalu lebih besar dari from", () => {
    const past = new Date("2024-06-15T00:00:00Z");
    const from = new Date("2026-05-01T00:00:00Z");
    const result = calcNextOccurrence("monthly", 1, past, from);
    expect(result > from).toBe(true);
  });

  it("weekly interval 2: maju 2 minggu sekaligus", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const from = new Date("2026-01-10T00:00:00Z");
    const result = calcNextOccurrence("weekly", 2, start, from);
    // 2026-01-01 + 2w = 2026-01-15 > 2026-01-10 ✓
    expect(result.toISOString().slice(0, 10)).toBe("2026-01-15");
  });
});

// ── occurrenceKey ─────────────────────────────────────────────────────────────

describe("occurrenceKey", () => {
  it("format YYYY-MM-DD", () => {
    const d = new Date("2026-05-15T12:00:00");
    expect(occurrenceKey(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("dua Date dengan tanggal lokal yang sama menghasilkan key yang sama", () => {
    // Buat dua Date dengan tanggal lokal yang sama (pagi dan siang hari ini)
    const today = new Date();
    today.setHours(8, 0, 0, 0);
    const todayLater = new Date();
    todayLater.setHours(20, 0, 0, 0);
    expect(occurrenceKey(today)).toBe(occurrenceKey(todayLater));
  });

  it("tanggal lokal berbeda menghasilkan key berbeda", () => {
    const day1 = new Date();
    day1.setDate(1);
    day1.setHours(12, 0, 0, 0);
    const day2 = new Date();
    day2.setDate(2);
    day2.setHours(12, 0, 0, 0);
    expect(occurrenceKey(day1)).not.toBe(occurrenceKey(day2));
  });
});

// ── describeFrequency ─────────────────────────────────────────────────────────

describe("describeFrequency", () => {
  it("interval 1: deskripsi tunggal", () => {
    expect(describeFrequency("daily", 1)).toBe("Setiap hari");
    expect(describeFrequency("weekly", 1)).toBe("Setiap minggu");
    expect(describeFrequency("monthly", 1)).toBe("Setiap bulan");
    expect(describeFrequency("yearly", 1)).toBe("Setiap tahun");
  });

  it("interval > 1: menyebut angka dan satuan", () => {
    expect(describeFrequency("daily", 3)).toBe("Setiap 3 hari");
    expect(describeFrequency("weekly", 2)).toBe("Setiap 2 minggu");
    expect(describeFrequency("monthly", 6)).toBe("Setiap 6 bulan");
    expect(describeFrequency("yearly", 2)).toBe("Setiap 2 tahun");
  });
});

// ── konstanta ─────────────────────────────────────────────────────────────────

describe("konstanta", () => {
  it("RECURRING_TYPES mencakup expense, income, transfer", () => {
    expect(RECURRING_TYPES).toContain("expense");
    expect(RECURRING_TYPES).toContain("income");
    expect(RECURRING_TYPES).toContain("transfer");
  });

  it("RECURRING_FREQUENCIES mencakup semua frekuensi", () => {
    expect(RECURRING_FREQUENCIES).toContain("daily");
    expect(RECURRING_FREQUENCIES).toContain("weekly");
    expect(RECURRING_FREQUENCIES).toContain("monthly");
    expect(RECURRING_FREQUENCIES).toContain("yearly");
  });
});
