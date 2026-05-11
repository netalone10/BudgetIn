const ID_SHORT_DATE_FORMAT = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const ID_LONG_DATE_FORMAT = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatTanggalID(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return ID_SHORT_DATE_FORMAT.format(d);
}

export function formatTanggalLengkapID(date: Date): string {
  return ID_LONG_DATE_FORMAT.format(date);
}

export function formatSignedIDR(amount: number, positivePrefix = ""): string {
  const sign = amount < 0 ? "-" : positivePrefix;
  return `${sign}Rp ${Math.abs(amount).toLocaleString("id-ID")}`;
}

export function formatIDR(amount: number): string {
  return `Rp ${Math.abs(amount).toLocaleString("id-ID")}`;
}

export function formatCompactIDR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace(".0", "")} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace(".0", "")} jt`;
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)} rb`;
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}
