/** Hitung nextDueDate bulan ini atau bulan depan berdasarkan dueDay */
export function calcNextDueDate(dueDay: number, from?: Date): Date {
  const base = from ?? new Date();
  const year = base.getFullYear();
  const month = base.getMonth();

  const clamp = (y: number, m: number, d: number) => {
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(d, last));
  };

  const thisMonth = clamp(year, month, dueDay);
  if (thisMonth > base) return thisMonth;

  const next = new Date(year, month + 1, 1);
  return clamp(next.getFullYear(), next.getMonth(), dueDay);
}
