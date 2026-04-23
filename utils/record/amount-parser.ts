/**
 * Tujuan: Pure utilities untuk parse dan validasi nominal uang dari prompt
 * Caller: utils/record/intent-handlers.ts, app/api/record/route.ts
 * Dependensi: -
 * Main Functions: parseNominalFromPrompt, correctAmount, isValidAmount
 * Side Effects: -
 */

export const NON_MONETARY_UNITS = /\b(?:kg|gram|gr|ons|ton|lot|unit|pcs|pack|lembar|batang|buah|meter|cm|mm|ml|liter|ltr|dus|karton|ekor|biji|potong|ikat|helai|lusin|kodi|tangkai|porsi|botol|kaleng|sachet|kantong|bungkus|kotak|toples)\b/i;
export const MONETARY_INDICATOR = /\d+\s*(?:rb|ribu|jt|juta|[ck]\b)|(?:rp\.?\s*|idr\s*)\d|\b\d{4,}\b/i;
export const REPORT_KEYWORDS = /\b(?:rekap|laporan|lihat|berapa|analisis|summary|ringkasan|pengeluaran|pemasukan bulan)\b/i;

export function parseNominalFromPrompt(text: string): number | null {
  const s = text.toLowerCase();
  const m1 = s.match(/(\d+)[.,](\d+)\s*jt/);
  if (m1) {
    const decimal = parseInt(m1[2]) / Math.pow(10, m1[2].length);
    return (parseInt(m1[1]) + decimal) * 1_000_000;
  }
  const m2 = s.match(/(\d+)\s*(?:jt|juta)/);
  if (m2) return parseInt(m2[1]) * 1_000_000;
  const m3 = s.match(/(\d+)\s*(?:rb|ribu)/);
  if (m3) return parseInt(m3[1]) * 1_000;
  const m4 = s.match(/(\d+)\s*k\b/);
  if (m4) return parseInt(m4[1]) * 1_000;
  return null;
}

export function correctAmount(prompt: string, aiAmount: number): number {
  const expected = parseNominalFromPrompt(prompt);
  if (!expected || aiAmount === expected) return aiAmount;
  const ratio = aiAmount / expected;
  if (Math.round(ratio) === 1000) return expected;
  if (Math.abs(ratio - 0.001) < 0.0001) return expected;
  return aiAmount;
}

export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000;
}
