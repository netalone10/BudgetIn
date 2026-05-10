-- Migration: RecurringBill → RecurringTransaction
-- Run BEFORE `prisma db push` so existing data is preserved.
-- Idempotent: safe to re-run; uses IF EXISTS / IF NOT EXISTS.

BEGIN;

-- ── 1. Rename tables ─────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "recurring_bills" RENAME TO "recurring_transactions";
ALTER TABLE IF EXISTS "bill_payments" RENAME TO "recurring_occurrences";

-- ── 2. recurring_transactions: add new columns ──────────────────────────────
ALTER TABLE "recurring_transactions"
  ADD COLUMN IF NOT EXISTS "type"            TEXT      NOT NULL DEFAULT 'expense',
  ADD COLUMN IF NOT EXISTS "frequency"       TEXT      NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS "interval"        INTEGER   NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "start_date"      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "end_date"        TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "last_run_at"     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "to_account_id"   TEXT,
  ADD COLUMN IF NOT EXISTS "savings_goal_id" TEXT;

-- Backfill start_date from next_due_date (or "now" as fallback)
UPDATE "recurring_transactions"
   SET "start_date" = COALESCE("next_due_date", NOW())
 WHERE "start_date" IS NULL;

-- Migrate last_paid_at → last_run_at (if old column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'recurring_transactions' AND column_name = 'last_paid_at'
  ) THEN
    UPDATE "recurring_transactions"
       SET "last_run_at" = "last_paid_at"
     WHERE "last_run_at" IS NULL;
  END IF;
END $$;

ALTER TABLE "recurring_transactions" ALTER COLUMN "start_date" SET NOT NULL;

-- Bump amount precision to (19,4) to match Transaction model
ALTER TABLE "recurring_transactions"
  ALTER COLUMN "amount" TYPE DECIMAL(19,4);

-- Drop legacy columns
ALTER TABLE "recurring_transactions" DROP COLUMN IF EXISTS "due_day";
ALTER TABLE "recurring_transactions" DROP COLUMN IF EXISTS "last_paid_at";

-- Drop legacy index that referenced due_day (will be auto-recreated by Prisma if needed)
DROP INDEX IF EXISTS "recurring_bills_user_id_due_day_idx";
DROP INDEX IF EXISTS "recurring_transactions_user_id_due_day_idx";

-- ── 3. recurring_occurrences: rename + add columns ──────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'recurring_occurrences' AND column_name = 'bill_id'
  ) THEN
    ALTER TABLE "recurring_occurrences" RENAME COLUMN "bill_id" TO "recurring_id";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'recurring_occurrences' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE "recurring_occurrences" RENAME COLUMN "paid_at" TO "occurred_at";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'recurring_occurrences' AND column_name = 'payment_month'
  ) THEN
    ALTER TABLE "recurring_occurrences" RENAME COLUMN "payment_month" TO "occurrence_key";
  END IF;
END $$;

ALTER TABLE "recurring_occurrences"
  ADD COLUMN IF NOT EXISTS "transfer_id" TEXT;

-- Bump amount precision
ALTER TABLE "recurring_occurrences"
  ALTER COLUMN "amount" TYPE DECIMAL(19,4);

-- Update FK + indexes naming (drop old, Prisma will recreate on db push)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_name = 'recurring_occurrences' AND constraint_name = 'bill_payments_bill_id_fkey'
  ) THEN
    ALTER TABLE "recurring_occurrences" RENAME CONSTRAINT "bill_payments_bill_id_fkey" TO "recurring_occurrences_recurring_id_fkey";
  END IF;
END $$;

DROP INDEX IF EXISTS "bill_payments_bill_id_payment_month_key";
DROP INDEX IF EXISTS "bill_payments_bill_id_paid_at_idx";

COMMIT;
