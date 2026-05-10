import { addDays, addMonths, addWeeks, addYears, format, startOfDay } from "date-fns";

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type RecurringType = "expense" | "income" | "transfer";

export const RECURRING_TYPES: RecurringType[] = ["expense", "income", "transfer"];
export const RECURRING_FREQUENCIES: RecurringFrequency[] = ["daily", "weekly", "monthly", "yearly"];

/** Advance `date` by `interval` units of `frequency`. Month/year addition clamps to last day. */
export function advanceDate(
  date: Date,
  frequency: RecurringFrequency,
  interval: number,
): Date {
  const step = Math.max(1, Math.floor(interval || 1));
  switch (frequency) {
    case "daily":   return addDays(date, step);
    case "weekly":  return addWeeks(date, step);
    case "monthly": return addMonths(date, step); // date-fns clamps month-end
    case "yearly":  return addYears(date, step);
  }
}

/**
 * Compute the next occurrence date strictly greater than `from`,
 * starting anchor `startDate` and stepping by `interval` units of `frequency`.
 */
export function calcNextOccurrence(
  frequency: RecurringFrequency,
  interval: number,
  startDate: Date,
  from: Date = new Date(),
): Date {
  const step = Math.max(1, Math.floor(interval || 1));
  let next = new Date(startDate);
  // If anchor is already in the future, that's the next occurrence.
  if (next > from) return next;
  // Walk forward until next > from (capped to avoid infinite loop on bad input).
  let safety = 0;
  while (next <= from && safety < 10000) {
    next = advanceDate(next, frequency, step);
    safety++;
  }
  return next;
}

/** Stable per-occurrence idempotency key derived from due date (yyyy-MM-dd). */
export function occurrenceKey(date: Date): string {
  return format(startOfDay(date), "yyyy-MM-dd");
}

export function describeFrequency(frequency: RecurringFrequency, interval: number): string {
  const n = Math.max(1, Math.floor(interval || 1));
  const unit =
    frequency === "daily"   ? "hari" :
    frequency === "weekly"  ? "minggu" :
    frequency === "monthly" ? "bulan" : "tahun";
  if (n === 1) {
    return frequency === "daily"   ? "Setiap hari" :
           frequency === "weekly"  ? "Setiap minggu" :
           frequency === "monthly" ? "Setiap bulan" : "Setiap tahun";
  }
  return `Setiap ${n} ${unit}`;
}
