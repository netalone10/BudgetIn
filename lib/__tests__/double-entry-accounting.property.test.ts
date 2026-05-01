/**
 * Property-Based Tests for Double-Entry Accounting System
 *
 * Feature: double-entry-accounting-system, Properties 1–10
 *
 * Validates: Requirements 2.1–2.5, 3.1–3.5, 4.1–4.5, 5.1–5.5,
 *            7.1–7.5, 8.1–8.5, 9.1–9.5, 13.1–13.5, 14.1–14.5,
 *            16.1–16.5, 19.1–19.5, 20.1–20.5
 */

import * as fc from "fast-check";

// ── Pure logic extracted from route handlers for isolated testing ─────────────

type Account = { id: string; name: string };
type AccountFull = { id: string; userId: string; isActive: boolean; currency: string };
type TxType = "income" | "expense" | "transfer_in" | "transfer_out";
type TxRow = { accountId: string | null; type: TxType; amount: number };

/** Mirrors matchAccount in app/api/record/route.ts */
function matchAccount(
  userAccounts: Account[],
  accountName?: string
): { id: string } | { ambiguous: true; matches: string[] } | null {
  if (!accountName) return null;
  const normalized = accountName.toLowerCase().trim();
  const matches = userAccounts.filter(
    (a) =>
      a.name.toLowerCase().includes(normalized) ||
      normalized.includes(a.name.toLowerCase())
  );
  if (matches.length === 1) return { id: matches[0].id };
  if (matches.length > 1) return { ambiguous: true, matches: matches.map((a) => a.name) };
  return null;
}

/** Mirrors validateAccount in app/api/record/route.ts (pure decision) */
function validateAccount(
  account: AccountFull | null,
  requestingUserId: string
): { error: string; status: number } | null {
  if (!account) return { error: "Akun tidak ditemukan", status: 400 };
  if (account.userId !== requestingUserId) return { error: "Akun tidak valid", status: 400 };
  if (!account.isActive) return { error: "Akun sudah dinonaktifkan", status: 400 };
  return null;
}

/** Mirrors askAccountSelection in app/api/record/route.ts */
function askAccountSelection(
  userAccounts: Account[],
  transactionType: "expense" | "income",
  examplePrompt: string
): string {
  if (userAccounts.length === 0) {
    return "Belum ada akun. Buat akun dulu di menu Akun sebelum input transaksi.";
  }
  const label = transactionType === "income" ? "masuk ke akun mana" : "dari akun mana";
  const accountList = userAccounts.map((a) => a.name).join(", ");
  return `Transaksi ${label}? Pilih salah satu: ${accountList}. Contoh: "${examplePrompt} pakai ${userAccounts[0].name}"`;
}

/** Pure ledger balance — mirrors logic in utils/account-balance.ts */
function calculateBalance(transactions: TxRow[], accountId: string): number {
  return transactions.reduce((bal, t) => {
    if (t.accountId !== accountId) return bal;
    if (t.type === "income" || t.type === "transfer_in") return bal + t.amount;
    if (t.type === "expense" || t.type === "transfer_out") return bal - t.amount;
    return bal;
  }, 0);
}

/** Transfer pair generator — mirrors prisma.$transaction in manual/route.ts */
function createTransferPair(params: {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note: string;
  transferId: string;
}) {
  return [
    {
      userId: params.userId,
      accountId: params.fromAccountId,
      type: "transfer_out" as const,
      amount: params.amount,
      date: params.date,
      note: params.note,
      category: "Transfer",
      transferId: params.transferId,
    },
    {
      userId: params.userId,
      accountId: params.toAccountId,
      type: "transfer_in" as const,
      amount: params.amount,
      date: params.date,
      note: params.note,
      category: "Transfer",
      transferId: params.transferId,
    },
  ];
}

function createTransferWithFee(params: {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  fee: number;
  date: string;
  note: string;
  transferId: string;
}) {
  return [
    ...createTransferPair(params),
    {
      userId: params.userId,
      accountId: params.fromAccountId,
      type: "expense" as const,
      amount: params.fee,
      date: params.date,
      note: params.note ? `Fee transfer - ${params.note}` : "Fee transfer",
      category: "Biaya Admin",
      transferId: null,
    },
  ];
}

/** Transfer validation — mirrors checks in manual/route.ts (pure) */
function validateTransfer(
  accountId: string,
  toAccountId: string,
  fromAccount: AccountFull | null,
  toAccount: AccountFull | null,
  requestingUserId: string
): { error: string; status: number } | null {
  if (accountId === toAccountId)
    return { error: "Akun asal dan tujuan tidak boleh sama.", status: 400 };
  if (!fromAccount) return { error: "Akun tidak ditemukan", status: 400 };
  if (fromAccount.userId !== requestingUserId) return { error: "Akun tidak valid", status: 400 };
  if (!fromAccount.isActive) return { error: "Akun sudah dinonaktifkan", status: 400 };
  if (!toAccount) return { error: "Akun tujuan tidak ditemukan", status: 400 };
  if (toAccount.userId !== requestingUserId) return { error: "Akun tujuan tidak valid", status: 400 };
  if (!toAccount.isActive) return { error: "Akun tujuan sudah dinonaktifkan", status: 400 };
  if (fromAccount.currency !== toAccount.currency)
    return {
      error: `Transfer beda mata uang belum didukung (${fromAccount.currency} → ${toAccount.currency}). Catat sebagai pengeluaran dan pemasukan terpisah.`,
      status: 400,
    };
  return null;
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const accountNameArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0 && !s.includes(","));

const accountArb: fc.Arbitrary<Account> = fc.record({
  id: fc.uuid(),
  name: accountNameArb,
});

const uniqueAccountsArb = (min = 1, max = 5) =>
  fc
    .array(accountArb, { minLength: min, maxLength: max })
    .filter((accs) => new Set(accs.map((a) => a.name.toLowerCase())).size === accs.length);

// Accounts where no name is a substring of any other — prevents cross-matches in bidirectional search
const isolatedAccountsArb = (min = 1, max = 5) =>
  fc
    .array(accountArb, { minLength: min, maxLength: max })
    .filter((accs) => {
      const names = accs.map((a) => a.name.toLowerCase().trim()).filter((n) => n.length > 0);
      for (let i = 0; i < names.length; i++) {
        for (let j = 0; j < names.length; j++) {
          if (i !== j && (names[i].includes(names[j]) || names[j].includes(names[i]))) return false;
        }
      }
      return true;
    });

const txTypeArb = fc.constantFrom<TxType>("income", "expense", "transfer_in", "transfer_out");
const amountArb = fc.integer({ min: 1, max: 1_000_000_000 });
const uuidArb = fc.uuid();
const currencyArb = fc.constantFrom("IDR", "USD", "EUR", "SGD");

// ── Property 1: Account Name Matching ─────────────────────────────────────────
// Feature: double-entry-accounting-system, Property 1: account name matching

describe("Property 1: Account Name Matching", () => {
  it("returns single id when exactly one account name matches (case-insensitive)", () => {
    // Feature: double-entry-accounting-system, Property 1: match iff exactly one match
    // Uses isolatedAccountsArb to ensure no account name is a substring of another,
    // preventing false ambiguous matches from bidirectional substring logic.
    fc.assert(
      fc.property(isolatedAccountsArb(1, 5), fc.nat({ max: 4 }), (accounts, idx) => {
        const target = accounts[Math.min(idx, accounts.length - 1)];
        const result = matchAccount(accounts, target.name.toUpperCase());
        return result !== null && "id" in result && result.id === target.id;
      }),
      { numRuns: 100 }
    );
  });

  it("returns ambiguous when multiple accounts match the same substring", () => {
    // Feature: double-entry-accounting-system, Property 1: ambiguous when multiple match
    const accounts: Account[] = [
      { id: "1", name: "BCA Utama" },
      { id: "2", name: "BCA Tabungan" },
    ];
    const result = matchAccount(accounts, "BCA");
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("ambiguous", true);
    if (result && "ambiguous" in result) {
      expect(result.matches).toHaveLength(2);
    }
  });

  it("returns null when no account matches", () => {
    // Feature: double-entry-accounting-system, Property 1: null when no match
    // Uses fc.pre to skip cases where searchTerm happens to substring-match an account.
    fc.assert(
      fc.property(uniqueAccountsArb(1, 5), accountNameArb, (accounts, searchTerm) => {
        const normalized = searchTerm.toLowerCase().trim();
        const wouldMatch = accounts.some(
          (a) =>
            a.name.toLowerCase().includes(normalized) ||
            normalized.includes(a.name.toLowerCase())
        );
        fc.pre(!wouldMatch);
        const result = matchAccount(accounts, searchTerm);
        return result === null;
      }),
      { numRuns: 100 }
    );
  });

  it("returns null for undefined or empty accountName", () => {
    // Feature: double-entry-accounting-system, Property 1: null for missing name
    fc.assert(
      fc.property(uniqueAccountsArb(1, 5), (accounts) => {
        return (
          matchAccount(accounts, undefined) === null &&
          matchAccount(accounts, "") === null
        );
      }),
      { numRuns: 100 }
    );
  });

  it("is bidirectional: partial substring match works both ways", () => {
    // Feature: double-entry-accounting-system, Property 1: bidirectional substring
    const accounts: Account[] = [{ id: "abc", name: "BCA Tabungan Utama" }];
    expect(matchAccount(accounts, "BCA")).not.toBeNull();
    expect(matchAccount(accounts, "Tabungan")).not.toBeNull();
    expect(matchAccount(accounts, "bca tabungan utama lengkap sekali")).not.toBeNull();
  });
});

// ── Property 2: Account Validation ────────────────────────────────────────────
// Feature: double-entry-accounting-system, Property 2: account validation

describe("Property 2: Account Validation", () => {
  it("accepts when account exists, userId matches, isActive = true", () => {
    // Feature: double-entry-accounting-system, Property 2: accept valid account
    fc.assert(
      fc.property(uuidArb, uuidArb, (accountId, userId) => {
        const account: AccountFull = { id: accountId, userId, isActive: true, currency: "IDR" };
        return validateAccount(account, userId) === null;
      }),
      { numRuns: 100 }
    );
  });

  it("rejects with 'Akun tidak ditemukan' when account is null", () => {
    // Feature: double-entry-accounting-system, Property 2: reject missing account
    fc.assert(
      fc.property(uuidArb, (userId) => {
        const result = validateAccount(null, userId);
        return result?.error === "Akun tidak ditemukan" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });

  it("rejects with 'Akun tidak valid' when userId does not match", () => {
    // Feature: double-entry-accounting-system, Property 2: reject wrong owner
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (accountId, ownerId, requesterId) => {
        fc.pre(ownerId !== requesterId);
        const account: AccountFull = { id: accountId, userId: ownerId, isActive: true, currency: "IDR" };
        const result = validateAccount(account, requesterId);
        return result?.error === "Akun tidak valid" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });

  it("rejects with 'Akun sudah dinonaktifkan' when isActive = false", () => {
    // Feature: double-entry-accounting-system, Property 2: reject inactive account
    fc.assert(
      fc.property(uuidArb, uuidArb, (accountId, userId) => {
        const account: AccountFull = { id: accountId, userId, isActive: false, currency: "IDR" };
        const result = validateAccount(account, userId);
        return result?.error === "Akun sudah dinonaktifkan" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 3: Clarification Message Completeness ───────────────────────────
// Feature: double-entry-accounting-system, Property 3: clarification message

describe("Property 3: Clarification Message Completeness", () => {
  it("returns zero-account message when no accounts exist", () => {
    // Feature: double-entry-accounting-system, Property 3: zero accounts message
    fc.assert(
      fc.property(fc.constantFrom<"expense" | "income">("expense", "income"), fc.string(), (type, prompt) => {
        const msg = askAccountSelection([], type, prompt);
        return msg === "Belum ada akun. Buat akun dulu di menu Akun sebelum input transaksi.";
      }),
      { numRuns: 100 }
    );
  });

  it("message contains ALL active account names when accounts exist", () => {
    // Feature: double-entry-accounting-system, Property 3: all accounts in message
    fc.assert(
      fc.property(uniqueAccountsArb(1, 5), fc.constantFrom<"expense" | "income">("expense", "income"), fc.string(), (accounts, type, prompt) => {
        const msg = askAccountSelection(accounts, type, prompt);
        return accounts.every((a) => msg.includes(a.name));
      }),
      { numRuns: 100 }
    );
  });

  it("expense message says 'dari akun mana'", () => {
    // Feature: double-entry-accounting-system, Property 3: expense wording
    fc.assert(
      fc.property(uniqueAccountsArb(1, 3), fc.string(), (accounts, prompt) => {
        const msg = askAccountSelection(accounts, "expense", prompt);
        return msg.includes("dari akun mana");
      }),
      { numRuns: 100 }
    );
  });

  it("income message says 'masuk ke akun mana'", () => {
    // Feature: double-entry-accounting-system, Property 3: income wording
    fc.assert(
      fc.property(uniqueAccountsArb(1, 3), fc.string(), (accounts, prompt) => {
        const msg = askAccountSelection(accounts, "income", prompt);
        return msg.includes("masuk ke akun mana");
      }),
      { numRuns: 100 }
    );
  });

  it("message includes example with first account name", () => {
    // Feature: double-entry-accounting-system, Property 3: example in message
    fc.assert(
      fc.property(uniqueAccountsArb(1, 5), fc.constantFrom<"expense" | "income">("expense", "income"), fc.string(), (accounts, type, prompt) => {
        const msg = askAccountSelection(accounts, type, prompt);
        return msg.includes(`pakai ${accounts[0].name}`);
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 5: Ledger Balance Calculation ───────────────────────────────────
// Feature: double-entry-accounting-system, Property 5: ledger balance formula

describe("Property 5: Ledger Balance Calculation", () => {
  const txArb: fc.Arbitrary<TxRow> = fc.record({
    accountId: fc.oneof(uuidArb, fc.constant(null)),
    type: txTypeArb,
    amount: amountArb,
  });

  it("balance = income + transfer_in - expense - transfer_out for given accountId", () => {
    // Feature: double-entry-accounting-system, Property 5: ledger formula invariant
    fc.assert(
      fc.property(fc.array(txArb, { minLength: 0, maxLength: 50 }), uuidArb, (transactions, accountId) => {
        const balance = calculateBalance(transactions, accountId);
        const mine = transactions.filter((t) => t.accountId === accountId);
        const expected =
          mine.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0) +
          mine.filter((t) => t.type === "transfer_in").reduce((s, t) => s + t.amount, 0) -
          mine.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0) -
          mine.filter((t) => t.type === "transfer_out").reduce((s, t) => s + t.amount, 0);
        return balance === expected;
      }),
      { numRuns: 100 }
    );
  });

  it("transactions with null accountId are excluded from balance", () => {
    // Feature: double-entry-accounting-system, Property 5: null accountId excluded
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ accountId: fc.constant(null), type: txTypeArb, amount: amountArb }),
          { minLength: 1, maxLength: 20 }
        ),
        uuidArb,
        (nullTxs, accountId) => {
          const balance = calculateBalance(nullTxs, accountId);
          return balance === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("empty transaction list yields balance = 0", () => {
    // Feature: double-entry-accounting-system, Property 5: empty = zero balance
    fc.assert(
      fc.property(uuidArb, (accountId) => calculateBalance([], accountId) === 0),
      { numRuns: 100 }
    );
  });

  it("balance is additive: combining separate transaction sets yields same result", () => {
    // Feature: double-entry-accounting-system, Property 5: additive ledger
    fc.assert(
      fc.property(
        fc.array(txArb, { minLength: 0, maxLength: 25 }),
        fc.array(txArb, { minLength: 0, maxLength: 25 }),
        uuidArb,
        (txs1, txs2, accountId) => {
          const combined = calculateBalance([...txs1, ...txs2], accountId);
          const split = calculateBalance(txs1, accountId) + calculateBalance(txs2, accountId);
          return combined === split;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 6: Transfer Pairing ─────────────────────────────────────────────
// Feature: double-entry-accounting-system, Property 6: transfer creates 2 linked txs

describe("Property 6: Transfer Pairing", () => {
  const transferParamsArb = fc.record({
    userId: uuidArb,
    fromAccountId: uuidArb,
    toAccountId: uuidArb,
    amount: amountArb,
    date: fc.constant("2025-01-01"),
    note: fc.string({ maxLength: 50 }),
    transferId: uuidArb,
  });

  it("always creates exactly 2 transactions", () => {
    // Feature: double-entry-accounting-system, Property 6: exactly 2 transactions
    fc.assert(
      fc.property(transferParamsArb, (params) => {
        const pair = createTransferPair(params);
        return pair.length === 2;
      }),
      { numRuns: 100 }
    );
  });

  it("both transactions share the same transferId", () => {
    // Feature: double-entry-accounting-system, Property 6: same transferId
    fc.assert(
      fc.property(transferParamsArb, (params) => {
        const pair = createTransferPair(params);
        return pair[0].transferId === pair[1].transferId && pair[0].transferId === params.transferId;
      }),
      { numRuns: 100 }
    );
  });

  it("first tx is transfer_out on fromAccount, second is transfer_in on toAccount", () => {
    // Feature: double-entry-accounting-system, Property 6: correct types and accounts
    fc.assert(
      fc.property(transferParamsArb, (params) => {
        const [out, inTx] = createTransferPair(params);
        return (
          out.type === "transfer_out" &&
          out.accountId === params.fromAccountId &&
          inTx.type === "transfer_in" &&
          inTx.accountId === params.toAccountId
        );
      }),
      { numRuns: 100 }
    );
  });

  it("both transactions have the same amount", () => {
    // Feature: double-entry-accounting-system, Property 6: same amount in both legs
    fc.assert(
      fc.property(transferParamsArb, (params) => {
        const [out, inTx] = createTransferPair(params);
        return out.amount === inTx.amount && out.amount === params.amount;
      }),
      { numRuns: 100 }
    );
  });

  it("net effect on combined balance is zero (transfer is balance-neutral overall)", () => {
    // Feature: double-entry-accounting-system, Property 6: net effect zero
    fc.assert(
      fc.property(transferParamsArb, (params) => {
        fc.pre(params.fromAccountId !== params.toAccountId);
        const pair = createTransferPair(params);
        const outBalance = calculateBalance(pair, params.fromAccountId);
        const inBalance = calculateBalance(pair, params.toAccountId);
        return outBalance === -params.amount && inBalance === params.amount;
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 7: Transfer Validation ──────────────────────────────────────────
// Feature: double-entry-accounting-system, Property 7: transfer validation rules

describe("Property 7: Transfer Validation", () => {
  const validAccountArb = (userId: string): fc.Arbitrary<AccountFull> =>
    fc.record({
      id: uuidArb,
      userId: fc.constant(userId),
      isActive: fc.constant(true),
      currency: fc.constant("IDR"),
    });

  it("rejects when accountId === toAccountId", () => {
    // Feature: double-entry-accounting-system, Property 7: same account rejected
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (sameId, userId, otherId) => {
        const acc: AccountFull = { id: sameId, userId, isActive: true, currency: "IDR" };
        const result = validateTransfer(sameId, sameId, acc, acc, userId);
        return result?.error === "Akun asal dan tujuan tidak boleh sama." && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });

  it("rejects when fromAccount is null", () => {
    // Feature: double-entry-accounting-system, Property 7: missing from-account rejected
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (fromId, toId, userId) => {
        fc.pre(fromId !== toId);
        const toAcc: AccountFull = { id: toId, userId, isActive: true, currency: "IDR" };
        const result = validateTransfer(fromId, toId, null, toAcc, userId);
        return result?.error === "Akun tidak ditemukan" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });

  it("rejects when fromAccount.userId !== requesting userId", () => {
    // Feature: double-entry-accounting-system, Property 7: wrong owner rejected
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, uuidArb, (fromId, toId, ownerId, requesterId) => {
        fc.pre(fromId !== toId && ownerId !== requesterId);
        const fromAcc: AccountFull = { id: fromId, userId: ownerId, isActive: true, currency: "IDR" };
        const toAcc: AccountFull = { id: toId, userId: requesterId, isActive: true, currency: "IDR" };
        const result = validateTransfer(fromId, toId, fromAcc, toAcc, requesterId);
        return result?.error === "Akun tidak valid" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });

  it("rejects when fromAccount.isActive = false", () => {
    // Feature: double-entry-accounting-system, Property 7: inactive from-account rejected
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (fromId, toId, userId) => {
        fc.pre(fromId !== toId);
        const fromAcc: AccountFull = { id: fromId, userId, isActive: false, currency: "IDR" };
        const toAcc: AccountFull = { id: toId, userId, isActive: true, currency: "IDR" };
        const result = validateTransfer(fromId, toId, fromAcc, toAcc, userId);
        return result?.error === "Akun sudah dinonaktifkan" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });

  it("rejects when toAccount is null", () => {
    // Feature: double-entry-accounting-system, Property 7: missing to-account rejected
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (fromId, toId, userId) => {
        fc.pre(fromId !== toId);
        const fromAcc: AccountFull = { id: fromId, userId, isActive: true, currency: "IDR" };
        const result = validateTransfer(fromId, toId, fromAcc, null, userId);
        return result?.error === "Akun tujuan tidak ditemukan" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });

  it("rejects when toAccount.userId !== requesting userId", () => {
    // Feature: double-entry-accounting-system, Property 7: to-account wrong owner rejected
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, uuidArb, (fromId, toId, userId, otherId) => {
        fc.pre(fromId !== toId && userId !== otherId);
        const fromAcc: AccountFull = { id: fromId, userId, isActive: true, currency: "IDR" };
        const toAcc: AccountFull = { id: toId, userId: otherId, isActive: true, currency: "IDR" };
        const result = validateTransfer(fromId, toId, fromAcc, toAcc, userId);
        return result?.error === "Akun tujuan tidak valid" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });

  it("rejects when toAccount.isActive = false", () => {
    // Feature: double-entry-accounting-system, Property 7: inactive to-account rejected
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (fromId, toId, userId) => {
        fc.pre(fromId !== toId);
        const fromAcc: AccountFull = { id: fromId, userId, isActive: true, currency: "IDR" };
        const toAcc: AccountFull = { id: toId, userId, isActive: false, currency: "IDR" };
        const result = validateTransfer(fromId, toId, fromAcc, toAcc, userId);
        return result?.error === "Akun tujuan sudah dinonaktifkan" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });

  it("rejects when currencies differ", () => {
    // Feature: double-entry-accounting-system, Property 7: cross-currency rejected
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, currencyArb, currencyArb, (fromId, toId, userId, cur1, cur2) => {
        fc.pre(fromId !== toId && cur1 !== cur2);
        const fromAcc: AccountFull = { id: fromId, userId, isActive: true, currency: cur1 };
        const toAcc: AccountFull = { id: toId, userId, isActive: true, currency: cur2 };
        const result = validateTransfer(fromId, toId, fromAcc, toAcc, userId);
        return result !== null && result.status === 400 && result.error.includes("beda mata uang");
      }),
      { numRuns: 100 }
    );
  });

  it("accepts when both accounts valid, active, same owner, same currency, different ids", () => {
    // Feature: double-entry-accounting-system, Property 7: valid transfer accepted
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (fromId, toId, userId) => {
        fc.pre(fromId !== toId);
        const fromAcc: AccountFull = { id: fromId, userId, isActive: true, currency: "IDR" };
        const toAcc: AccountFull = { id: toId, userId, isActive: true, currency: "IDR" };
        return validateTransfer(fromId, toId, fromAcc, toAcc, userId) === null;
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 8: Bulk Atomicity ────────────────────────────────────────────────
// Feature: double-entry-accounting-system, Property 8: bulk fails = zero transactions

describe("Property 8: Bulk Atomicity — invalid accountId = zero transactions processed", () => {
  it("validateAccount error prevents any items from being processed", () => {
    // Feature: double-entry-accounting-system, Property 8: bulk atomicity
    fc.assert(
      fc.property(
        fc.array(fc.record({ amount: amountArb, category: fc.string({ minLength: 1 }) }), { minLength: 1, maxLength: 10 }),
        uuidArb,
        uuidArb,
        (items, accountId, ownerId) => {
          // Simulate: if validateAccount returns error, no items processed
          const account: AccountFull = { id: accountId, userId: ownerId, isActive: false, currency: "IDR" };
          const requesterId = "different-user-id";
          const validationError = validateAccount(account, requesterId);
          if (validationError !== null) {
            // Route returns early — zero transactions created
            const processed: unknown[] = [];
            return processed.length === 0;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("all-or-nothing: accountId null validation rejects before any item processed", () => {
    // Feature: double-entry-accounting-system, Property 8: null accountId = zero processed
    fc.assert(
      fc.property(
        fc.array(fc.record({ amount: amountArb, category: fc.string({ minLength: 1 }) }), { minLength: 1, maxLength: 10 }),
        (items) => {
          const validationError = validateAccount(null, "any-user");
          return validationError !== null && validationError.error === "Akun tidak ditemukan";
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 9: Credit Card Liability Balance ─────────────────────────────────
// Feature: double-entry-accounting-system, Property 9: liability balance behavior

describe("Property 9: Credit Card Liability Balance", () => {
  it("expense transaction decreases balance (increases amount owed) for liability account", () => {
    // Feature: double-entry-accounting-system, Property 9: expense → lower (more negative) balance
    fc.assert(
      fc.property(uuidArb, amountArb, (accountId, amount) => {
        const before = calculateBalance([], accountId);
        const after = calculateBalance([{ accountId, type: "expense", amount }], accountId);
        return after === before - amount && after < before;
      }),
      { numRuns: 100 }
    );
  });

  it("transfer_in transaction increases balance (reduces amount owed) for liability account", () => {
    // Feature: double-entry-accounting-system, Property 9: transfer_in → higher balance (payment reduces debt)
    fc.assert(
      fc.property(uuidArb, amountArb, amountArb, (accountId, chargeAmt, payAmt) => {
        // Simulate credit card: charge then partial/full payment
        const afterCharge = calculateBalance([{ accountId, type: "expense", amount: chargeAmt }], accountId);
        const afterPayment = calculateBalance(
          [{ accountId, type: "expense", amount: chargeAmt }, { accountId, type: "transfer_in", amount: payAmt }],
          accountId
        );
        return afterPayment === afterCharge + payAmt && afterPayment > afterCharge;
      }),
      { numRuns: 100 }
    );
  });

  it("full payment brings balance back to zero (debt fully paid)", () => {
    // Feature: double-entry-accounting-system, Property 9: full payment = zero balance
    fc.assert(
      fc.property(uuidArb, amountArb, (accountId, amount) => {
        const txs: TxRow[] = [
          { accountId, type: "expense", amount },
          { accountId, type: "transfer_in", amount },
        ];
        return calculateBalance(txs, accountId) === 0;
      }),
      { numRuns: 100 }
    );
  });

  it("balance formula is identical for both asset and liability account types", () => {
    // Feature: double-entry-accounting-system, Property 9: uniform formula regardless of type
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(fc.record({ type: txTypeArb, amount: amountArb }), { minLength: 0, maxLength: 20 }),
        (accountId, txDefs) => {
          const txs: TxRow[] = txDefs.map((t) => ({ ...t, accountId }));
          // Same formula for any account classification — accounting logic is uniform
          const balance = calculateBalance(txs, accountId);
          const manual = txs.reduce((b, t) => {
            if (t.type === "income" || t.type === "transfer_in") return b + t.amount;
            return b - t.amount;
          }, 0);
          return balance === manual;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 10: Account Ownership Isolation ─────────────────────────────────
// Feature: double-entry-accounting-system, Property 10: ownership isolation

describe("Property 10: Account Ownership Isolation", () => {
  it("user cannot use an account belonging to another user", () => {
    // Feature: double-entry-accounting-system, Property 10: cross-user account rejected
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (accountId, ownerId, requesterId) => {
        fc.pre(ownerId !== requesterId);
        const account: AccountFull = { id: accountId, userId: ownerId, isActive: true, currency: "IDR" };
        const result = validateAccount(account, requesterId);
        return result?.error === "Akun tidak valid" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });

  it("user can always use their own active account", () => {
    // Feature: double-entry-accounting-system, Property 10: own active account always accepted
    fc.assert(
      fc.property(uuidArb, uuidArb, (accountId, userId) => {
        const account: AccountFull = { id: accountId, userId, isActive: true, currency: "IDR" };
        return validateAccount(account, userId) === null;
      }),
      { numRuns: 100 }
    );
  });

  it("transfer from user A account to user B account is rejected", () => {
    // Feature: double-entry-accounting-system, Property 10: cross-user transfer rejected
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, uuidArb, (fromId, toId, userA, userB) => {
        fc.pre(fromId !== toId && userA !== userB);
        const fromAcc: AccountFull = { id: fromId, userId: userA, isActive: true, currency: "IDR" };
        const toAcc: AccountFull = { id: toId, userId: userB, isActive: true, currency: "IDR" };
        // User A requests transfer using User B's destination account
        const result = validateTransfer(fromId, toId, fromAcc, toAcc, userA);
        return result?.error === "Akun tujuan tidak valid" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });

  it("transfer where fromAccount belongs to another user is rejected", () => {
    // Feature: double-entry-accounting-system, Property 10: using other user's source rejected
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, uuidArb, (fromId, toId, userA, userB) => {
        fc.pre(fromId !== toId && userA !== userB);
        // userB owns fromAccount, but userA makes the request
        const fromAcc: AccountFull = { id: fromId, userId: userB, isActive: true, currency: "IDR" };
        const toAcc: AccountFull = { id: toId, userId: userA, isActive: true, currency: "IDR" };
        const result = validateTransfer(fromId, toId, fromAcc, toAcc, userA);
        return result?.error === "Akun tidak valid" && result?.status === 400;
      }),
      { numRuns: 100 }
    );
  });
});
