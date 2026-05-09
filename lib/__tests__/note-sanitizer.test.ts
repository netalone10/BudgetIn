import { sanitizeTransactionNote } from "@/utils/record/note-sanitizer";

describe("sanitizeTransactionNote", () => {
  test("removes relative date from note", () => {
    expect(sanitizeTransactionNote("makan ayam kemarin")).toBe("makan ayam");
  });

  test("removes relative time from note", () => {
    expect(sanitizeTransactionNote("kopi tadi pagi")).toBe("kopi");
  });

  test("removes explicit hour from note", () => {
    expect(sanitizeTransactionNote("bayar listrik jam 14:30")).toBe("bayar listrik");
  });

  test("removes explicit date from note", () => {
    expect(sanitizeTransactionNote("nasi padang tanggal 8 Mei")).toBe("nasi padang");
  });

  test("keeps regular description", () => {
    expect(sanitizeTransactionNote("makan ayam geprek kantor")).toBe("makan ayam geprek kantor");
  });
});
