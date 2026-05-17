import fc from "fast-check";

/**
 * Property 1: Bug Condition — Email Name Sanitization Missing
 *
 * This test encodes the EXPECTED behavior: user names containing URLs, HTML tags,
 * or domain patterns MUST be sanitized (HTML entity escaped) before rendering in
 * email templates, so that no clickable hyperlinks or injected markup appear.
 *
 * On UNFIXED code, this test MUST FAIL — failure confirms the bug exists:
 * - `sendVerificationEmail` interpolates `${name}` directly into HTML without escaping
 * - `sendPasswordResetEmail` interpolates `${name}` directly into HTML without escaping
 * - Email clients auto-link URLs/domains in text content
 * - Raw HTML tags are rendered as markup
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2, 5.3**
 */

// ---------------------------------------------------------------------------
// Mock Resend to capture HTML output without actually sending emails
// ---------------------------------------------------------------------------

let lastSentHtml: string = "";

jest.mock("resend", () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockImplementation((payload: { html?: string }) => {
          lastSentHtml = payload.html ?? "";
          return Promise.resolve({ data: { id: "mock-id" }, error: null });
        }),
      },
    })),
  };
});

// Import AFTER mocking
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "@/lib/email";

// ---------------------------------------------------------------------------
// Helper: Check if HTML contains dangerous unescaped content from name
// ---------------------------------------------------------------------------

/**
 * Checks whether the rendered HTML contains the raw (unescaped) dangerous content.
 * For the email to be safe, dangerous characters must be HTML-entity-escaped:
 * - `<` → `&lt;`
 * - `>` → `&gt;`
 * - `&` → `&amp;`
 * - `"` → `&quot;`
 * - `'` → `&#x27;` or `&#39;`
 *
 * Additionally, raw URLs/domains should not appear as plain text that email clients
 * would auto-link into clickable hyperlinks.
 */
function htmlContainsRawUrl(html: string, url: string): boolean {
  // Check if the URL appears as raw text in the HTML (not entity-escaped)
  // A safe rendering would escape dots and slashes or wrap in a way that
  // prevents auto-linking. At minimum, the URL should not appear verbatim.
  return html.includes(url);
}

function htmlContainsUnescapedHtmlTags(html: string, tag: string): boolean {
  // If the tag appears as-is in the HTML, it means it was NOT escaped
  // Safe rendering would convert `<script>` to `&lt;script&gt;`
  return html.includes(tag);
}

function htmlContainsDomainPattern(html: string, domain: string): boolean {
  // If a domain like "evil.com" appears as raw text, email clients will auto-link it
  return html.includes(domain);
}

// ---------------------------------------------------------------------------
// Generators — Scoped to concrete failing cases
// ---------------------------------------------------------------------------

/** Names containing URLs that email clients would auto-link */
const nameWithUrlArb = fc.constantFrom(
  "click evil.com",
  "visit https://phishing.com now",
  "check http://malware.org/payload",
  "klik disini evil.com",
  "info www.scam-site.net",
  "admin https://fake-budgetin.com/verify",
  "support http://evil.xyz/login",
);

/** Names containing HTML tags that would be rendered as markup */
const nameWithHtmlTagsArb = fc.constantFrom(
  '<script>alert(1)</script>',
  '<a href="https://phishing.com">Verifikasi Ulang</a>',
  '<img src="x" onerror="alert(1)">',
  '<b onclick="steal()">Important</b>',
  '<iframe src="https://evil.com"></iframe>',
  '<div style="position:absolute">Overlay</div>',
);

/** Names containing domain patterns that email clients auto-link */
const nameWithDomainArb = fc.constantFrom(
  "admin https://phishing.com/verify",
  "support@evil.com click here",
  "transfer ke rekening evil.com",
  "budi evil.org",
  "info scam-site.net segera",
  "verify account at phishing.io/reset",
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 1: Bug Condition — Email Name Sanitization Missing", () => {
  beforeEach(() => {
    lastSentHtml = "";
  });

  describe("sendVerificationEmail — URL in name", () => {
    it("name containing URL should NOT render raw URL in HTML output (must be escaped)", async () => {
      /**
       * EXPECTED BEHAVIOR: When a user registers with a name containing a URL,
       * the email HTML should NOT contain the raw URL text that email clients
       * would auto-link into a clickable hyperlink.
       *
       * ON UNFIXED CODE: This will FAIL because `${name}` is interpolated
       * directly without any escaping — the raw URL appears in the HTML.
       */
      await fc.assert(
        fc.asyncProperty(nameWithUrlArb, async (maliciousName) => {
          await sendVerificationEmail("test@example.com", maliciousName, "token123");

          const html = lastSentHtml;

          // Extract the URL/domain from the name
          const urlMatch = maliciousName.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.(com|net|org|io|xyz|[a-z]{2,})[^\s]*)/i);
          if (!urlMatch) return true; // No URL found, skip

          const dangerousUrl = urlMatch[0];

          // EXPECTED: The dangerous URL should NOT appear as raw text in the HTML
          // (it should be entity-escaped so email clients don't auto-link it)
          // ACTUAL (buggy): The raw URL appears verbatim in the HTML output
          return !htmlContainsRawUrl(html, dangerousUrl);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("sendVerificationEmail — HTML tags in name", () => {
    it("name containing HTML tags should NOT render unescaped tags in output", async () => {
      /**
       * EXPECTED BEHAVIOR: When a user registers with a name containing HTML tags,
       * the email HTML should contain entity-escaped versions (e.g., &lt;script&gt;)
       * NOT the raw tags that would be rendered as markup.
       *
       * ON UNFIXED CODE: This will FAIL because `${name}` is interpolated
       * directly — raw HTML tags appear in the email template as actual markup.
       */
      await fc.assert(
        fc.asyncProperty(nameWithHtmlTagsArb, async (maliciousName) => {
          await sendVerificationEmail("test@example.com", maliciousName, "token123");

          const html = lastSentHtml;

          // Extract the HTML tag from the name
          const tagMatch = maliciousName.match(/<[a-zA-Z][^>]*>/);
          if (!tagMatch) return true; // No tag found, skip

          const dangerousTag = tagMatch[0];

          // EXPECTED: The HTML tag should NOT appear as raw markup in the output
          // (it should be escaped: `<script>` → `&lt;script&gt;`)
          // ACTUAL (buggy): The raw tag appears in the HTML, potentially rendering as markup
          return !htmlContainsUnescapedHtmlTags(html, dangerousTag);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("sendPasswordResetEmail — domain pattern in name", () => {
    it("name containing domain pattern should NOT render auto-linkable text", async () => {
      /**
       * EXPECTED BEHAVIOR: When a password reset email is sent for a user whose
       * name contains domain patterns, the email HTML should NOT contain raw
       * domain text that email clients would auto-link.
       *
       * ON UNFIXED CODE: This will FAIL because `${name}` is interpolated
       * directly in sendPasswordResetEmail — domains appear as auto-linkable text.
       */
      await fc.assert(
        fc.asyncProperty(nameWithDomainArb, async (maliciousName) => {
          await sendPasswordResetEmail("test@example.com", maliciousName, "tempPass123");

          const html = lastSentHtml;

          // Extract domain patterns from the name
          const domainMatch = maliciousName.match(/(https?:\/\/[^\s]+|[a-z0-9-]+\.(com|net|org|io|xyz|[a-z]{2,})[^\s]*)/i);
          if (!domainMatch) return true; // No domain found, skip

          const dangerousDomain = domainMatch[0];

          // EXPECTED: The domain should NOT appear as raw text that gets auto-linked
          // ACTUAL (buggy): The raw domain appears verbatim in the HTML
          return !htmlContainsDomainPattern(html, dangerousDomain);
        }),
        { numRuns: 50 }
      );
    });
  });
});
