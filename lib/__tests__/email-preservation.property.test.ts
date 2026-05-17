import fc from "fast-check";
import { escapeHtml } from "../email";

/**
 * Property 2: Preservation — Normal Name Display in Email Templates
 *
 * These tests verify that the current (unfixed) code correctly renders legitimate
 * names in email templates. They capture the baseline behavior that MUST be preserved
 * after implementing the email sanitization fix.
 *
 * Observation-first methodology:
 * - sendVerificationEmail("Budi Santoso", email) renders "Hai, Budi Santoso! 👋" correctly
 * - sendVerificationEmail("Dr. Smith", email) renders name with period correctly
 * - sendVerificationEmail("محمد", email) renders Arabic name correctly
 * - sendVerificationEmail("田中太郎", email) renders CJK name correctly
 * - sendRecurringReminderEmail renders bill names correctly
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */

// ---------------------------------------------------------------------------
// Mock Resend to capture HTML output without sending emails
// ---------------------------------------------------------------------------

let lastSentHtml: string = "";
let lastSentSubject: string = "";

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockImplementation((payload: { html?: string; subject?: string }) => {
        lastSentHtml = payload.html ?? "";
        lastSentSubject = payload.subject ?? "";
        return Promise.resolve({ data: { id: "mock-id" }, error: null });
      }),
    },
  })),
}));

// Import after mock setup
import {
  sendVerificationEmail,
  sendRecurringReminderEmail,
} from "../email";

// ---------------------------------------------------------------------------
// Generators for legitimate names
// ---------------------------------------------------------------------------

/** Latin names with common characters */
const latinNameArb = fc.constantFrom(
  "Budi Santoso",
  "Maria Garcia",
  "John Smith",
  "Anna Mueller",
  "Pierre Dupont",
  "Carlos Silva",
  "Elena Petrova",
  "Hans Weber",
  "Luca Rossi",
  "Emma Wilson",
  "David Brown",
  "Sophie Martin",
  "Marco Polo",
  "Julia Roberts",
  "Alex Johnson",
);

/** Names with common punctuation (periods, hyphens, apostrophes, commas) */
const punctuatedNameArb = fc.constantFrom(
  "Dr. Smith",
  "O'Brien",
  "Jean-Pierre",
  "Smith, Jr.",
  "Dr. A. B. Johnson",
  "Mary-Jane O'Connor",
  "Prof. Dr. Mueller",
  "St. Claire",
  "D'Angelo",
  "Al-Rashid",
  "Kim Jong-un",
  "Siti Nur'aini",
  "R.A. Kartini",
  "M. Nasir",
  "Ir. Soekarno",
);

/** Arabic/Middle Eastern names */
const arabicNameArb = fc.constantFrom(
  "محمد",
  "عبدالله",
  "فاطمة",
  "أحمد بن علي",
  "خالد",
  "نور الدين",
  "عائشة",
  "يوسف",
  "إبراهيم",
  "مريم",
);

/** CJK (Chinese, Japanese, Korean) names */
const cjkNameArb = fc.constantFrom(
  "田中太郎",
  "山田花子",
  "李明",
  "王小明",
  "김민수",
  "박지영",
  "佐藤健",
  "鈴木一郎",
  "陳大文",
  "林志玲",
);

/** Indonesian/Javanese names */
const indonesianNameArb = fc.constantFrom(
  "Budi Santoso",
  "Siti Nurhaliza",
  "Agus Prasetyo",
  "Dewi Lestari",
  "Bambang Pamungkas",
  "Raden Ajeng Kartini",
  "Megawati Soekarnoputri",
  "Joko Widodo",
  "Sri Mulyani",
  "Tri Rismaharini",
);

/** Combined legitimate name generator */
const legitimateNameArb = fc.oneof(
  latinNameArb,
  punctuatedNameArb,
  arabicNameArb,
  cjkNameArb,
  indonesianNameArb,
);

/** Bill name generator for recurring reminders */
const billNameArb = fc.constantFrom(
  "Internet Indihome",
  "Listrik PLN",
  "Air PDAM",
  "Netflix",
  "Spotify Premium",
  "Cicilan Rumah",
  "Asuransi Kesehatan",
  "Iuran RT",
  "Gym Membership",
  "Cloud Storage",
  "Domain .com",
  "Sewa Kos",
  "Angsuran Motor",
  "BPJS Kesehatan",
  "TV Kabel",
);

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function getLastSentHtml(): string {
  return lastSentHtml;
}

function resetCapture(): void {
  lastSentHtml = "";
  lastSentSubject = "";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 2: Preservation — Normal Name Display in Email Templates", () => {
  beforeEach(() => {
    resetCapture();
  });

  describe("Verification email renders legitimate names correctly and completely", () => {
    it("for all legitimate names, email HTML output contains the name rendered correctly", async () => {
      /**
       * Preservation property: For all legitimate names (Latin letters, non-Latin
       * scripts, common punctuation like `.`, `,`, `'`, `-`), the verification email
       * HTML output contains the name rendered correctly and completely in the
       * greeting "Hai, {name}! 👋".
       *
       * **Validates: Requirements 6.1, 6.2**
       */
      await fc.assert(
        fc.asyncProperty(legitimateNameArb, async (name) => {
          resetCapture();
          await sendVerificationEmail("test@example.com", name, "test-token-123");
          const html = getLastSentHtml();

          // The name must appear in the greeting correctly (HTML-escaped form
          // renders identically to the original in email clients)
          const escapedName = escapeHtml(name);
          expect(html).toContain(`Hai, ${escapedName}! 👋`);
        }),
        { numRuns: 100 }
      );
    });

    it("Latin names with common punctuation render correctly in verification email", async () => {
      /**
       * Preservation property: Names containing periods, hyphens, apostrophes,
       * and commas (e.g., "Dr. Smith", "O'Brien", "Jean-Pierre") render correctly
       * in the email template without modification.
       *
       * **Validates: Requirements 6.1**
       */
      await fc.assert(
        fc.asyncProperty(punctuatedNameArb, async (name) => {
          resetCapture();
          await sendVerificationEmail("test@example.com", name, "test-token-456");
          const html = getLastSentHtml();

          // Name with punctuation must appear correctly (HTML-escaped form
          // renders identically in email clients — &#x27; displays as ')
          const escapedName = escapeHtml(name);
          expect(html).toContain(`Hai, ${escapedName}! 👋`);
          // The escaped name must be present in the HTML
          expect(html).toContain(escapedName);
        }),
        { numRuns: 15 }
      );
    });

    it("Arabic names render correctly in verification email", async () => {
      /**
       * Preservation property: Arabic/Middle Eastern names render correctly
       * in the email template without modification or corruption.
       *
       * **Validates: Requirements 6.2**
       */
      await fc.assert(
        fc.asyncProperty(arabicNameArb, async (name) => {
          resetCapture();
          await sendVerificationEmail("test@example.com", name, "test-token-789");
          const html = getLastSentHtml();

          const escapedName = escapeHtml(name);
          expect(html).toContain(`Hai, ${escapedName}! 👋`);
          expect(html).toContain(escapedName);
        }),
        { numRuns: 10 }
      );
    });

    it("CJK names render correctly in verification email", async () => {
      /**
       * Preservation property: Chinese, Japanese, and Korean names render
       * correctly in the email template without modification or corruption.
       *
       * **Validates: Requirements 6.2**
       */
      await fc.assert(
        fc.asyncProperty(cjkNameArb, async (name) => {
          resetCapture();
          await sendVerificationEmail("test@example.com", name, "test-token-abc");
          const html = getLastSentHtml();

          const escapedName = escapeHtml(name);
          expect(html).toContain(`Hai, ${escapedName}! 👋`);
          expect(html).toContain(escapedName);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe("Verification link remains valid and clickable for all legitimate names", () => {
    it("for all legitimate names, verification link in email remains valid and clickable", async () => {
      /**
       * Preservation property: For all legitimate names, the verification link
       * in the email is a valid URL containing the token parameter and is properly
       * formatted as an HTML anchor tag with href attribute.
       *
       * **Validates: Requirements 6.3**
       */
      await fc.assert(
        fc.asyncProperty(
          legitimateNameArb,
          fc.uuid(),
          async (name, token) => {
            resetCapture();
            await sendVerificationEmail("test@example.com", name, token);
            const html = getLastSentHtml();

            // Verification link must be present and properly formatted
            const expectedLink = `/api/verify-email?token=${token}`;
            expect(html).toContain(expectedLink);

            // Link must be in an anchor tag with href
            expect(html).toContain(`href="`);
            expect(html).toMatch(/href="[^"]*\/api\/verify-email\?token=/);

            // The "Verifikasi Email" button text must be present
            expect(html).toContain("Verifikasi Email");
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("Recurring reminder email renders bill names correctly", () => {
    it("for all legitimate bill names, recurring reminder email renders bill name correctly", async () => {
      /**
       * Preservation property: For all legitimate bill names, the recurring
       * reminder email renders the bill name correctly and completely in the
       * bill details section.
       *
       * **Validates: Requirements 6.4**
       */
      await fc.assert(
        fc.asyncProperty(
          billNameArb,
          fc.integer({ min: 10000, max: 50000000 }),
          fc.constantFrom("expense" as const, "income" as const, "transfer" as const),
          async (billName, amount, type) => {
            resetCapture();
            await sendRecurringReminderEmail({
              to: "test@example.com",
              name: billName,
              type,
              amount,
              dueDate: new Date("2024-03-15"),
              daysUntil: 3,
            });
            const html = getLastSentHtml();

            // Bill name must appear in the email body (HTML-escaped form)
            const escapedBillName = escapeHtml(billName);
            expect(html).toContain(escapedBillName);

            // Amount must be formatted and present
            expect(html).toContain("Rp");

            // Due date must be present
            expect(html).toContain("Jatuh tempo");
          }
        ),
        { numRuns: 15 }
      );
    });

    it("bill names with special characters render correctly in recurring reminder", async () => {
      /**
       * Preservation property: Bill names containing periods, slashes, and
       * other common characters (e.g., "Domain .com", "TV Kabel") render
       * correctly without modification.
       *
       * **Validates: Requirements 6.4**
       */
      const specialBillNames = fc.constantFrom(
        "Domain .com",
        "Internet 50Mbps",
        "Cicilan 12x",
        "BPJS Kes.",
        "Sewa Kos - Lantai 2",
        "Netflix (Family)",
      );

      await fc.assert(
        fc.asyncProperty(specialBillNames, async (billName) => {
          resetCapture();
          await sendRecurringReminderEmail({
            to: "test@example.com",
            name: billName,
            type: "expense",
            amount: 150000,
            dueDate: new Date("2024-03-20"),
            daysUntil: 5,
          });
          const html = getLastSentHtml();

          // Bill name must appear correctly (HTML-escaped form renders identically)
          const escapedBillName = escapeHtml(billName);
          expect(html).toContain(escapedBillName);
        }),
        { numRuns: 6 }
      );
    });

    it("recurring reminder email subject contains bill name correctly", async () => {
      /**
       * Preservation property: The email subject line contains the bill name
       * correctly for all legitimate bill names.
       *
       * **Validates: Requirements 6.4**
       */
      await fc.assert(
        fc.asyncProperty(billNameArb, async (billName) => {
          resetCapture();
          await sendRecurringReminderEmail({
            to: "test@example.com",
            name: billName,
            type: "expense",
            amount: 200000,
            dueDate: new Date("2024-04-01"),
            daysUntil: 2,
          });

          // Subject should contain the bill name
          expect(lastSentSubject).toContain(billName);
        }),
        { numRuns: 15 }
      );
    });
  });
});
