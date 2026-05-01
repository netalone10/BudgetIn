/**
 * Tujuan: Pure utilities untuk parse dan validasi nominal uang dari prompt
 * Caller: utils/record/intent-handlers.ts, app/api/record/route.ts
 * Dependensi: -
 * Main Functions: parseNominalFromPrompt, correctAmount, isValidAmount
 * Side Effects: -
 */

export const NON_MONETARY_UNITS = /\b(?:kg|gram|gr|ons|ton|lot|unit|pcs|pack|lembar|batang|buah|meter|cm|mm|ml|liter|ltr|dus|karton|ekor|biji|potong|ikat|helai|lusin|kodi|tangkai|porsi|botol|kaleng|sachet|kantong|bungkus|kotak|toples)\b/i;
export const MONETARY_INDICATOR = /(?:-|minus\s+)?\d+\s*(?:rb|ribu|jt|juta|[ck]\b)|(?:-|minus\s+)?(?:rp\.?\s*|idr\s*)\d|(?:-|minus\s+)?\b\d{4,}\b/i;
export const REPORT_KEYWORDS = /\b(?:rekap|laporan|lihat|berapa|analisis|summary|ringkasan|pengeluaran|pemasukan bulan)\b/i;

const SIGN_PREFIX = "(-|minus\\s+)?";

function signOf(match: RegExpMatchArray): number {
  return match[1] ? -1 : 1;
}

export function parseNominalFromPrompt(text: string): number | null {
  const s = text.toLowerCase();
  const m1 = s.match(new RegExp(`${SIGN_PREFIX}(\\d+)[.,](\\d+)\\s*jt`));
  if (m1) {
    const decimal = parseInt(m1[3]) / Math.pow(10, m1[3].length);
    return signOf(m1) * (parseInt(m1[2]) + decimal) * 1_000_000;
  }
  const m2 = s.match(new RegExp(`${SIGN_PREFIX}(\\d+)\\s*(?:jt|juta)`));
  if (m2) return signOf(m2) * parseInt(m2[2]) * 1_000_000;
  const m3 = s.match(new RegExp(`${SIGN_PREFIX}(\\d+)\\s*(?:rb|ribu)`));
  if (m3) return signOf(m3) * parseInt(m3[2]) * 1_000;
  const m4 = s.match(new RegExp(`${SIGN_PREFIX}(\\d+)\\s*k\\b`));
  if (m4) return signOf(m4) * parseInt(m4[2]) * 1_000;
  return null;
}

const MONETARY_TOKEN_GLOBAL = /(?:-|minus\s+)?\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k\b)/gi;

export function countMonetaryTokens(text: string): number {
  const matches = text.match(MONETARY_TOKEN_GLOBAL);
  return matches ? matches.length : 0;
}

export function correctAmount(prompt: string, aiAmount: number): number {
  const expected = parseNominalFromPrompt(prompt);
  if (!expected || aiAmount === expected) return aiAmount;
  // Single monetary token in prompt → trust the deterministic regex parse over LLM output.
  // Handles cases like "bayar 18rb" where AI returns 180.000 (10× error) instead of 18.000.
  if (countMonetaryTokens(prompt) === 1) return expected;
  // Multi-token prompts: keep legacy behavior (only fix exact 1000× / 0.001× ratio mistakes)
  // to avoid wrongly overriding aggregated amounts (e.g. "bayar 18rb tip 2rb" → 20.000).
  const ratio = Math.abs(aiAmount) / Math.abs(expected);
  if (Math.round(ratio) === 1000) return expected;
  if (Math.abs(ratio - 0.001) < 0.0001) return expected;
  return aiAmount;
}

export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount !== 0 && Math.abs(amount) <= 1_000_000_000;
}
