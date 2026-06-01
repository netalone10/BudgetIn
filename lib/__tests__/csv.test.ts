import {
  escapeCsvValue,
  toCsv,
  withBom,
  buildTransactionsCsv,
  TRANSACTION_CSV_HEADERS,
  type CsvTransactionRow,
} from "@/lib/csv";

describe("escapeCsvValue", () => {
  it("returns empty string for null/undefined", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("leaves simple values unquoted", () => {
    expect(escapeCsvValue("Makan")).toBe("Makan");
    expect(escapeCsvValue(35000)).toBe("35000");
    expect(escapeCsvValue(0)).toBe("0");
  });

  it("quotes and escapes values containing comma", () => {
    expect(escapeCsvValue("Beli kopi, roti")).toBe('"Beli kopi, roti"');
  });

  it("quotes and doubles internal double-quotes", () => {
    expect(escapeCsvValue('Beli "kopi"')).toBe('"Beli ""kopi"""');
  });

  it("quotes values containing newlines or carriage returns", () => {
    expect(escapeCsvValue("baris1\nbaris2")).toBe('"baris1\nbaris2"');
    expect(escapeCsvValue("a\r\nb")).toBe('"a\r\nb"');
  });
});

describe("toCsv", () => {
  it("joins headers and rows with CRLF and commas", () => {
    const csv = toCsv(["A", "B"], [["1", "2"], ["3", "4"]]);
    expect(csv).toBe("A,B\r\n1,2\r\n3,4");
  });

  it("escapes cells that need it", () => {
    const csv = toCsv(["Nama", "Note"], [["Budi", "a, b"]]);
    expect(csv).toBe('Nama,Note\r\nBudi,"a, b"');
  });

  it("renders null/undefined cells as empty", () => {
    const csv = toCsv(["A", "B"], [[null, undefined]]);
    expect(csv).toBe("A,B\r\n,");
  });
});

describe("withBom", () => {
  it("prepends a UTF-8 BOM", () => {
    expect(withBom("abc")).toBe("﻿abc");
    expect(withBom("abc").charCodeAt(0)).toBe(0xfeff);
  });
});

describe("buildTransactionsCsv", () => {
  const sample: CsvTransactionRow[] = [
    {
      date: "2026-05-01",
      time: "08:30",
      type: "expense",
      category: "Makan",
      amount: 35000,
      accountName: "BCA",
      note: "sarapan",
    },
    {
      date: "2026-05-02",
      time: "12:00",
      type: "income",
      category: "Gaji",
      amount: 8000000,
      accountName: "BNI",
      note: "",
    },
    {
      date: "2026-05-03",
      time: "15:00",
      type: "transfer_out",
      category: "Transfer",
      amount: 1000000,
      accountName: "BCA",
      toAccountName: "Jago",
      note: null,
    },
  ];

  it("starts with a BOM", () => {
    expect(buildTransactionsCsv(sample).charCodeAt(0)).toBe(0xfeff);
  });

  it("includes the Indonesian header row", () => {
    const csv = buildTransactionsCsv(sample);
    const firstLine = csv.slice(1).split("\r\n")[0];
    expect(firstLine).toBe(TRANSACTION_CSV_HEADERS.join(","));
  });

  it("maps type codes to Indonesian labels", () => {
    const csv = buildTransactionsCsv(sample);
    expect(csv).toContain("Pengeluaran");
    expect(csv).toContain("Pemasukan");
    expect(csv).toContain("Transfer Keluar");
  });

  it("writes amount as raw number without thousands separator", () => {
    const csv = buildTransactionsCsv(sample);
    expect(csv).toContain("8000000");
    expect(csv).not.toContain("8.000.000");
  });

  it("emits one header + one row per transaction", () => {
    const csv = buildTransactionsCsv(sample);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(1 + sample.length);
  });

  it("renders empty cells for missing account/note", () => {
    const csv = buildTransactionsCsv([
      { date: "2026-05-01", type: "expense", category: "Lain", amount: 100 },
    ]);
    const row = csv.slice(1).split("\r\n")[1];
    // Tanggal,Waktu,Tipe,Kategori,Nominal,Akun,Akun Tujuan,Catatan
    expect(row).toBe("2026-05-01,,Pengeluaran,Lain,100,,,");
  });

  it("handles an empty transaction list (header only)", () => {
    const csv = buildTransactionsCsv([]);
    expect(csv.slice(1)).toBe(TRANSACTION_CSV_HEADERS.join(","));
  });
});
