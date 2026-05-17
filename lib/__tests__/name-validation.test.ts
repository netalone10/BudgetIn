import { validateName, sanitizeName } from "@/lib/name-validation";

describe("validateName", () => {
  describe("rejects names with URL patterns", () => {
    it("rejects names containing http:// URLs", () => {
      const result = validateName("click http://evil.com");
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });

    it("rejects names containing https:// URLs", () => {
      const result = validateName("admin https://phishing.com/verify");
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });

    it("rejects names containing www. patterns", () => {
      const result = validateName("info www.scam-site.net");
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });
  });

  describe("rejects names with HTML tags", () => {
    it("rejects names with script tags", () => {
      const result = validateName('<script>alert(1)</script>');
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });

    it("rejects names with anchor tags", () => {
      const result = validateName('<a href="https://phishing.com">Verifikasi</a>');
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });

    it("rejects names with img tags", () => {
      const result = validateName('<img src="x" onerror="alert(1)">');
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });
  });

  describe("rejects names with standalone domain patterns", () => {
    it("rejects names containing .com domains", () => {
      const result = validateName("budi evil.com");
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });

    it("rejects names containing .net domains", () => {
      const result = validateName("info scam-site.net segera");
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });

    it("rejects names containing .org domains", () => {
      const result = validateName("budi evil.org");
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });

    it("rejects names containing domain with path", () => {
      const result = validateName("verify account at phishing.io/reset");
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });
  });

  describe("rejects empty/invalid names", () => {
    it("rejects empty string", () => {
      const result = validateName("");
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });

    it("rejects whitespace-only string", () => {
      const result = validateName("   ");
      expect(result).toEqual({
        valid: false,
        error: "Nama tidak valid. Silakan gunakan nama asli Anda.",
      });
    });
  });

  describe("allows legitimate names", () => {
    it("allows simple Latin names", () => {
      expect(validateName("Budi Santoso")).toEqual({ valid: true });
    });

    it("allows names with periods (Dr.)", () => {
      expect(validateName("Dr. Smith")).toEqual({ valid: true });
    });

    it("allows names with periods (Jr.)", () => {
      expect(validateName("John Smith Jr.")).toEqual({ valid: true });
    });

    it("allows names with initials", () => {
      expect(validateName("R.A. Kartini")).toEqual({ valid: true });
    });

    it("allows names with hyphens", () => {
      expect(validateName("Jean-Pierre")).toEqual({ valid: true });
    });

    it("allows names with apostrophes", () => {
      expect(validateName("O'Brien")).toEqual({ valid: true });
    });

    it("allows names with commas", () => {
      expect(validateName("Smith, John")).toEqual({ valid: true });
    });

    it("allows Arabic names", () => {
      expect(validateName("محمد")).toEqual({ valid: true });
    });

    it("allows CJK names", () => {
      expect(validateName("田中太郎")).toEqual({ valid: true });
    });

    it("allows Javanese script names", () => {
      expect(validateName("ꦱꦸꦫꦺꦴꦠꦺꦴ")).toEqual({ valid: true });
    });

    it("allows mixed Latin and non-Latin", () => {
      expect(validateName("Ahmad محمد")).toEqual({ valid: true });
    });

    it("allows names with multiple spaces", () => {
      expect(validateName("Maria de la Cruz")).toEqual({ valid: true });
    });
  });
});

describe("sanitizeName", () => {
  describe("strips URL patterns", () => {
    it("strips http:// URLs", () => {
      expect(sanitizeName("click http://evil.com here")).toBe("click here");
    });

    it("strips https:// URLs", () => {
      expect(sanitizeName("admin https://phishing.com/verify")).toBe("admin");
    });

    it("strips www. patterns", () => {
      expect(sanitizeName("info www.scam-site.net")).toBe("info");
    });
  });

  describe("strips HTML tags", () => {
    it("strips script tags", () => {
      expect(sanitizeName('<script>alert(1)</script>')).toBe("alert(1)");
    });

    it("strips anchor tags", () => {
      expect(sanitizeName('<a href="https://phishing.com">Verifikasi</a>')).toBe("Verifikasi");
    });

    it("strips img tags", () => {
      expect(sanitizeName('<img src="x" onerror="alert(1)"> Budi')).toBe("Budi");
    });
  });

  describe("strips domain patterns", () => {
    it("strips .com domains", () => {
      expect(sanitizeName("budi evil.com")).toBe("budi");
    });

    it("strips .net domains", () => {
      expect(sanitizeName("info scam-site.net segera")).toBe("info segera");
    });

    it("strips domains with paths", () => {
      expect(sanitizeName("verify phishing.io/reset")).toBe("verify");
    });
  });

  describe("preserves legitimate names", () => {
    it("preserves simple names", () => {
      expect(sanitizeName("Budi Santoso")).toBe("Budi Santoso");
    });

    it("preserves names with Dr.", () => {
      expect(sanitizeName("Dr. Smith")).toBe("Dr. Smith");
    });

    it("preserves names with initials", () => {
      expect(sanitizeName("R.A. Kartini")).toBe("R.A. Kartini");
    });

    it("preserves names with hyphens", () => {
      expect(sanitizeName("Jean-Pierre")).toBe("Jean-Pierre");
    });

    it("preserves names with apostrophes", () => {
      expect(sanitizeName("O'Brien")).toBe("O'Brien");
    });

    it("preserves Arabic names", () => {
      expect(sanitizeName("محمد")).toBe("محمد");
    });

    it("preserves CJK names", () => {
      expect(sanitizeName("田中太郎")).toBe("田中太郎");
    });
  });

  describe("collapses extra whitespace", () => {
    it("collapses multiple spaces after stripping", () => {
      expect(sanitizeName("Budi   Santoso")).toBe("Budi Santoso");
    });

    it("trims leading/trailing whitespace", () => {
      expect(sanitizeName("  Budi Santoso  ")).toBe("Budi Santoso");
    });
  });
});
