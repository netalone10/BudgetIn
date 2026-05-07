import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";
export const LEGACY_TRANSACTION_TIME = "00:00";
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EXPLICIT_TIME_RE = /\b(?:jam|pukul)?\s*([01]?\d|2[0-3])[:.]([0-5]\d)\b/;
const HOUR_TIME_RE = /\b(?:jam|pukul)\s+([01]?\d|2[0-3])\b/;
const CURRENT_TIME_RE = /\b(?:barusan|sekarang)\b/;

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
  const explicit = text.match(EXPLICIT_TIME_RE);
  if (explicit) {
    return `${explicit[1].padStart(2, "0")}:${explicit[2]}`;
  }

  const hourMatch = text.match(HOUR_TIME_RE);
  if (hourMatch) {
    let hour = Number(hourMatch[1]);
    if (/\b(?:siang|sore|malam)\b/.test(text) && hour >= 1 && hour <= 11) hour += 12;
    if (/\bpagi\b/.test(text) && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:00`;
  }

  if (CURRENT_TIME_RE.test(text)) return fallback;
  return fallback;
}

export function hasTransactionTimeCue(prompt: string): boolean {
  const text = prompt.toLowerCase();
  return EXPLICIT_TIME_RE.test(text) || HOUR_TIME_RE.test(text) || CURRENT_TIME_RE.test(text);
}

export function resolvePromptTransactionTime(prompt: string, parsedTime: unknown, fallback: string): string {
  const promptTime = parseTransactionTimeFromPrompt(prompt, fallback);
  return hasTransactionTimeCue(prompt) ? normalizeTransactionTime(parsedTime, promptTime) : promptTime;
}

export function compareTransactionDateTimeDesc(
  a: { date: string; time?: string | null },
  b: { date: string; time?: string | null }
): number {
  const aKey = `${a.date}T${normalizeTransactionTime(a.time)}`;
  const bKey = `${b.date}T${normalizeTransactionTime(b.time)}`;
  return bKey.localeCompare(aKey);
}
