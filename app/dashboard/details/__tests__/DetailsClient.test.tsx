/**
 * @jest-environment jsdom
 */

// Per-file `@jest-environment` pragma keeps the rest of the suite running on
// the default `node` env (see `jest.config.js`). Only this integration test
// needs jsdom because it mounts `DetailsClient` end-to-end.

import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { rest } from "msw";
import { setupServer } from "msw/node";

// ── Module mocks ────────────────────────────────────────────────────────────
// `next-auth/react` reads from a SessionContext that's only provided by
// `<SessionProvider>` in the real app. Stub `useSession` and `signOut` so the
// component can mount and the "Sesi expired" CTA can be exercised without
// network calls to `/api/auth/signout`.
jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signOut: jest.fn(),
}));

// `useDataEvent` subscribes via `BroadcastChannel`. jsdom may not have one,
// and we want a deterministic test — stub the module to no-ops so external
// data-change events never fire and `emitDataChanged` is a recorded fn.
jest.mock("@/lib/data-events", () => ({
  emitDataChanged: jest.fn(),
  subscribeDataChanged: () => () => {},
  useDataEvent: () => {},
}));

// Imported AFTER the mocks above so the component picks up our stubs.
 
import DetailsClient from "../DetailsClient";

// ── Fixture data ────────────────────────────────────────────────────────────
type FixtureTx = {
  id: string;
  date: string;
  time: string;
  amount: number;
  category: string;
  note: string;
  type: "expense" | "income" | "transfer_out" | "transfer_in";
  accountId: string | null;
  created_at: string;
};

const txFixture: FixtureTx[] = [
  // expense — Makan (200_000 across 2 transactions)
  {
    id: "e1",
    date: "2024-03-01",
    time: "08:00",
    amount: 80000,
    category: "Makan",
    note: "Sarapan",
    type: "expense",
    accountId: "a1",
    created_at: "2024-03-01T08:00:00Z",
  },
  {
    id: "e2",
    date: "2024-03-02",
    time: "12:00",
    amount: 120000,
    category: "Makan",
    note: "Pesta makan-makan",
    type: "expense",
    accountId: "a1",
    created_at: "2024-03-02T12:00:00Z",
  },
  // expense — Transport (50_000)
  {
    id: "e3",
    date: "2024-03-03",
    time: "06:00",
    amount: 50000,
    category: "Transport",
    note: "Bensin motor",
    type: "expense",
    accountId: "a1",
    created_at: "2024-03-03T06:00:00Z",
  },
  // income — Gaji (5_000_000)
  {
    id: "i1",
    date: "2024-03-25",
    time: "09:00",
    amount: 5000000,
    category: "Gaji",
    note: "Gaji bulanan",
    type: "income",
    accountId: "a1",
    created_at: "2024-03-25T09:00:00Z",
  },
];

// ── MSW setup ───────────────────────────────────────────────────────────────
let recordCalls: string[] = [];

function defaultHandlers() {
  return [
    rest.get("*/api/record", (req, res, ctx) => {
      recordCalls.push(req.url.search);
      return res(ctx.status(200), ctx.json({ transactions: txFixture }));
    }),
    rest.get("*/api/categories", (_req, res, ctx) =>
      res(
        ctx.status(200),
        ctx.json({
          categories: [
            { id: "c1", name: "Makan", type: "expense" },
            { id: "c2", name: "Transport", type: "expense" },
            { id: "c3", name: "Gaji", type: "income" },
          ],
        }),
      ),
    ),
    rest.get("*/api/accounts", (_req, res, ctx) =>
      res(
        ctx.status(200),
        ctx.json({
          accounts: [{ id: "a1", name: "BCA", currency: "IDR" }],
        }),
      ),
    ),
  ];
}

const server = setupServer(...defaultHandlers());

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  // After MSW installs its `globalThis.fetch` interceptor, wrap it so that
  // relative URLs (e.g. `/api/record`) are resolved against
  // `window.location.href` BEFORE MSW's URL parser sees them. The Node host
  // fetch (Node 18+) doesn't accept relative URLs and would throw
  // `TypeError: Invalid URL` otherwise.
  const inner = (globalThis as { fetch: typeof fetch }).fetch;
  const wrapped: typeof fetch = ((
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    if (typeof input === "string" && input.startsWith("/")) {
      input = new URL(input, window.location.href).toString();
    }
    return inner(input as RequestInfo | URL, init);
  }) as typeof fetch;
  (globalThis as { fetch: typeof fetch }).fetch = wrapped;
  // Mirror onto `window` since component code may resolve `fetch` against
  // either depending on how the bundler/Babel emit looks it up.
  if (typeof window !== "undefined") {
    (window as unknown as { fetch: typeof fetch }).fetch = wrapped;
  }
});
afterEach(() => {
  server.resetHandlers(...defaultHandlers());
  recordCalls = [];
});
afterAll(() => server.close());

// ── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Find the `CategoryRow` trigger button for a given category.
 *
 * `CategoryRow` renders a `<button>` whose accessible name is the
 * concatenation of the category label, count badge, share %, and IDR amount.
 * Anchoring the regex at the start lets us match only the row trigger
 * (period pills and reset filter buttons don't start with category names).
 */
function getCategoryRowTrigger(category: string): HTMLElement {
  return screen.getByRole("button", {
    name: new RegExp(`^${category}\\b`, "i"),
  });
}

function queryCategoryRowTrigger(category: string): HTMLElement | null {
  return screen.queryByRole("button", {
    name: new RegExp(`^${category}\\b`, "i"),
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe("DetailsClient (integration)", () => {
  // Validates: Requirements 2.1 (default tab is expense) and that the
  // expense aggregation surfaces after the initial fetch.
  it("default tab is Pengeluaran and renders expenseGroups after fetch", async () => {
    render(<DetailsClient />);

    // Wait for the initial fetch to settle and expense rows to appear.
    expect(await screen.findByRole("button", { name: /^Makan\b/i })).toBeInTheDocument();
    expect(getCategoryRowTrigger("Transport")).toBeInTheDocument();

    const expenseTab = screen.getByRole("tab", { name: /Pengeluaran/i });
    expect(expenseTab).toHaveAttribute("aria-selected", "true");

    const incomeTab = screen.getByRole("tab", { name: /Pemasukan/i });
    expect(incomeTab).toHaveAttribute("aria-selected", "false");

    // Income groups must NOT render while expense tab is active.
    expect(queryCategoryRowTrigger("Gaji")).toBeNull();
  });

  // Validates: Requirements 2.3 (income groups on Pemasukan click) +
  // 2.5 (no fresh `/api/record` request on tab change alone).
  it("clicking Pemasukan tab swaps to incomeGroups without firing a new /api/record request", async () => {
    render(<DetailsClient />);
    await screen.findByRole("button", { name: /^Makan\b/i });
    const initialCallCount = recordCalls.length;
    expect(initialCallCount).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: /Pemasukan/i }));

    // Income group should render and expense rows should be gone.
    expect(await screen.findByRole("button", { name: /^Gaji\b/i })).toBeInTheDocument();
    expect(queryCategoryRowTrigger("Makan")).toBeNull();
    expect(queryCategoryRowTrigger("Transport")).toBeNull();

    // No additional record fetch should have been triggered.
    expect(recordCalls.length).toBe(initialCallCount);
  });

  // Validates: Requirements 6.5, 6.7 — clicking a row sets aria-expanded=true
  // and lazy-mounts a `role="region"` containing member transactions.
  it("clicking a category row sets aria-expanded='true' and renders a role='region' with member transactions", async () => {
    render(<DetailsClient />);
    const trigger = await screen.findByRole("button", { name: /^Makan\b/i });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // Region must NOT be in the tree before expand (lazy mount, Req 6.6).
    expect(screen.queryByRole("region", { name: /Makan/i })).toBeNull();

    fireEvent.click(trigger);

    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "true"),
    );

    const region = screen.getByRole("region", { name: /Makan/i });
    expect(within(region).getByText(/Sarapan/)).toBeInTheDocument();
    expect(within(region).getByText(/Pesta makan-makan/)).toBeInTheDocument();
  });

  // Validates: Requirements 3.6 — changing period clears expanded state.
  it("changing period clears expanded state", async () => {
    render(<DetailsClient />);
    const trigger = await screen.findByRole("button", { name: /^Makan\b/i });

    fireEvent.click(trigger);
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "true"),
    );

    // Switch to a different period — triggers a fresh fetch and a reset.
    fireEvent.click(screen.getByRole("button", { name: /^Hari ini$/i }));

    // After the new fetch settles, the Makan row reappears collapsed and
    // the previously-mounted region is gone.
    await waitFor(() => {
      const t = queryCategoryRowTrigger("Makan");
      expect(t).not.toBeNull();
      expect(t).toHaveAttribute("aria-expanded", "false");
    });
    expect(screen.queryByRole("region", { name: /Makan/i })).toBeNull();
  });

  // Validates: Requirements 4.5 — search input filters the visible groups
  // by lowercase haystack of `note + " " + category`.
  it("search input filters the visible groups", async () => {
    render(<DetailsClient />);
    await screen.findByRole("button", { name: /^Makan\b/i });
    expect(getCategoryRowTrigger("Transport")).toBeInTheDocument();

    const search = screen.getByLabelText(/Cari transaksi/i);
    fireEvent.change(search, { target: { value: "Bensin" } });

    // Only Transport should remain (note "Bensin motor" matches).
    await waitFor(() => {
      expect(queryCategoryRowTrigger("Makan")).toBeNull();
    });
    expect(getCategoryRowTrigger("Transport")).toBeInTheDocument();
  });

  // Validates: Requirements 10.1 — 401 `token_expired` shows the dedicated
  // session-expired message.
  it("renders 'Sesi expired' message when /api/record returns 401 token_expired", async () => {
    server.use(
      rest.get("*/api/record", (_req, res, ctx) =>
        res(ctx.status(401), ctx.json({ error: "token_expired" })),
      ),
    );

    render(<DetailsClient />);

    expect(await screen.findByText(/Sesi expired/i)).toBeInTheDocument();
  });
});
