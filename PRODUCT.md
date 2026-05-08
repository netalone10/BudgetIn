# BudgetIn Product Brief

## Register
product

## Users
BudgetIn is for Indonesian personal finance users who want to track money without maintaining a spreadsheet by hand. The primary users are young workers, students, and non-technical users who need a fast way to record daily transactions, understand cashflow, and keep multiple wallets or accounts under control.

It also serves users who care about owning their data through Google Sheets, and users with several account types such as cash, bank accounts, e-wallets, savings accounts, investment accounts, and credit cards.

## Product Purpose
BudgetIn helps users record transactions, manage accounts and wallets, monitor monthly budgets, save toward goals, manage recurring bills, and read financial insights with AI assistance.

The product's core promise is fast capture: users can type natural language prompts like `beli makan siang 35rb dari BCA`, while manual forms remain available for transactions that need exact control.

BudgetIn is not a business accounting suite, bank-sync product, native mobile app, household shared wallet, multi-currency conversion tool, or professional financial advisor replacement.

## Brand / Tone
BudgetIn should feel friendly, practical, calm, and trustworthy. It speaks Bahasa Indonesia clearly and avoids financial jargon when a simpler phrase works.

The interface should feel like a helpful personal finance companion: quick enough for daily habits, accurate enough for financial decisions, and light enough to not feel like bank administration.

## UI Direction
The UI should be compact, clean, app-like, and task-first. The current direction uses a restrained pastel pink and teal palette with soft surfaces, rounded controls, readable numbers, and clear hierarchy.

Forms should feel fast and non-intimidating. The AI prompt is the fastest path, while manual forms should be structured, scannable, and precise without looking heavy.

The product register is more important than decoration: standard controls, predictable layouts, strong focus states, clear disabled states, and consistent component vocabulary should take priority over novelty.

## Anti-Reference
Avoid interfaces that feel too enterprise, too banking-formal, too neon, too decorative, or too card-heavy. Avoid generic SaaS dashboards where every section is a nested card. Avoid UI that hides important numbers, makes forms feel bureaucratic, or uses color as decoration instead of state and priority.

Do not use gradient text, decorative glassmorphism, thick side-stripe accents, non-standard form affordances, or motion that does not communicate state.

## Strategic Principles
- Fast capture first: transaction input must stay quick through prompt or manual form.
- Financial correctness first: balances, transfers, budgets, savings, and account effects must be accurate before visual cleverness.
- Numbers must be readable: rupiah amounts, balances, totals, and remaining budget should never overlap, truncate unexpectedly, or lose visual priority.
- Manual forms should be lightweight: precise enough for control, but not intimidating or bank-like.
- User-owned data matters: Google Sheets and backup/restore flows are part of the product value, not secondary details.
- AI is an assistant, not the source of truth: AI can classify, summarize, and suggest, but deterministic financial data remains authoritative.
- Low-friction maintenance: new UI should preserve both DB and Google Sheets paths, existing transaction logic, and data refresh behavior.
