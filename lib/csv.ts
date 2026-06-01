/**
 * Utilitas CSV — escaping mengikuti RFC 4180.
 *
 * Dipakai untuk fitur export transaksi ke CSV. Murni (tanpa dependency
 * server/Next) sehingga mudah di-unit-test.
 */

/**
 * Escape satu nilai untuk CSV: bungkus dengan tanda kutip ganda jika nilai
 * mengandung koma, tanda kutip, atau newline; gandakan tanda kutip internal.
 */
export function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Bangun string CSV dari baris header + baris data. Setiap sel di-escape.
 * Baris dipisah CRLF sesuai RFC 4180.
 */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");
}

/**
 * Tambahkan BOM UTF-8 di awal string agar Excel membuka file dengan encoding
 * yang benar (tanpa BOM, karakter non-ASCII seperti "é"/"Rp" bisa rusak).
 */
export function withBom(csv: string): string {
  return "﻿" + csv;
}

// ─── Builder khusus transaksi ─────────────────────────────────────────────────

export interface CsvTransactionRow {
  date: string;
  time?: string | null;
  /** expense | income | transfer_out | transfer_in */
  type: string;
  category: string;
  amount: number;
  accountName?: string | null;
  toAccountName?: string | null;
  note?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  expense: "Pengeluaran",
  income: "Pemasukan",
  transfer_out: "Transfer Keluar",
  transfer_in: "Transfer Masuk",
};

export const TRANSACTION_CSV_HEADERS = [
  "Tanggal",
  "Waktu",
  "Tipe",
  "Kategori",
  "Nominal",
  "Akun",
  "Akun Tujuan",
  "Catatan",
];

/**
 * Bangun CSV transaksi lengkap dengan header Indonesia + BOM UTF-8.
 * Nominal ditulis sebagai angka mentah (tanpa pemisah ribuan) agar
 * mudah diolah ulang di spreadsheet.
 */
export function buildTransactionsCsv(rows: CsvTransactionRow[]): string {
  const data = rows.map((r) => [
    r.date,
    r.time ?? "",
    TYPE_LABELS[r.type] ?? r.type,
    r.category,
    r.amount,
    r.accountName ?? "",
    r.toAccountName ?? "",
    r.note ?? "",
  ]);
  return withBom(toCsv(TRANSACTION_CSV_HEADERS, data));
}
