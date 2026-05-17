// Set dummy env var before importing email module (Resend requires API key)
process.env.RESEND_API_KEY = "re_test_dummy_key_for_unit_tests";

import { escapeHtml } from "@/lib/email";

describe("escapeHtml", () => {
  describe("escapes HTML special characters", () => {
    it("escapes < to &lt;", () => {
      expect(escapeHtml("<")).toBe("&lt;");
    });

    it("escapes > to &gt;", () => {
      expect(escapeHtml(">")).toBe("&gt;");
    });

    it("escapes & to &amp;", () => {
      expect(escapeHtml("&")).toBe("&amp;");
    });

    it('escapes " to &quot;', () => {
      expect(escapeHtml('"')).toBe("&quot;");
    });

    it("escapes ' to &#x27;", () => {
      expect(escapeHtml("'")).toBe("&#x27;");
    });
  });

  describe("escapes multiple characters in a string", () => {
    it("escapes HTML tags", () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
      );
    });

    it("escapes anchor tags with attributes", () => {
      expect(escapeHtml('<a href="https://evil.com">click</a>')).toBe(
        '&lt;a href=&quot;https://evil.com&quot;&gt;click&lt;/a&gt;'
      );
    });

    it("escapes ampersands in URLs", () => {
      expect(escapeHtml("foo&bar=1&baz=2")).toBe("foo&amp;bar=1&amp;baz=2");
    });
  });

  describe("preserves safe content", () => {
    it("preserves plain text names", () => {
      expect(escapeHtml("Budi Santoso")).toBe("Budi Santoso");
    });

    it("preserves non-Latin characters", () => {
      expect(escapeHtml("محمد")).toBe("محمد");
    });

    it("preserves CJK characters", () => {
      expect(escapeHtml("田中太郎")).toBe("田中太郎");
    });

    it("preserves names with periods and hyphens", () => {
      expect(escapeHtml("Dr. Jean-Pierre")).toBe("Dr. Jean-Pierre");
    });

    it("preserves empty string", () => {
      expect(escapeHtml("")).toBe("");
    });

    it("preserves numbers and spaces", () => {
      expect(escapeHtml("123 456")).toBe("123 456");
    });

    it("preserves emoji", () => {
      expect(escapeHtml("Hello 👋")).toBe("Hello 👋");
    });
  });

  describe("handles apostrophes in names", () => {
    it("escapes apostrophe in O'Brien", () => {
      expect(escapeHtml("O'Brien")).toBe("O&#x27;Brien");
    });

    it("escapes apostrophe in contractions", () => {
      expect(escapeHtml("it's")).toBe("it&#x27;s");
    });
  });
});
