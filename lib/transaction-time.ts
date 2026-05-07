import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";
export const LEGACY_TRANSACTION_TIME = "00:00";
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTransactionTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

export function currentJakartaTime(): string {
  return format(toZonedTime(new Date(), TIMEZONE), "HH:mm");
}

export function normalizeTransactionTime(value: unknown, fallback = LEGACY_TRANSACTION_TIME): string {
  return isValidTransactionTime(value) ? value : fallback;
}

export function parseTransactionTimeFromPrompt(prompt: string, fallback: string): string {
  const text = prompt.toLowerCase();
  const explicit = text.match(/\b(?:jam|pukul)?\s*([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (explicit) {
    return `${explicit[1].padStart(2, "0")}:${explicit[2]}`;
  }

  const hourMatch = text.match(/\b(?:jam|pukul)\s+([01]?\d|2[0-3])\b/);
  if (hourMatch) {
    let hour = Number(hourMatch[1]);
    if (/\b(?:siang|sore|malam)\b/.test(text) && hour >= 1 && hour <= 11) hour += 12;
    if (/\bpagi\b/.test(text) && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:00`;
  }

  if (/\b(?:barusan|sekarang)\b/.test(text)) return fallback;
  return fallback;
}

export function compareTransactionDateTimeDesc(
  a: { date: string; time?: string | null },
  b: { date: string; time?: string | null }
): number {
  const aKey = `${a.date}T${normalizeTransactionTime(a.time)}`;
  const bKey = `${b.date}T${normalizeTransactionTime(b.time)}`;
  return bKey.localeCompare(aKey);
}
