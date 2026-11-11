-- Merge PaymentLogEvent into PaymentLog (Approach B: pure append-only event log).
--
-- 1. Drops PaymentLogEvent table and its triggers.
-- 2. Makes PaymentLog an append-only event table:
--    - Drops unique constraint on reference (multiple events share one reference).
--    - Adds type, reason, reportedAmountKobo, reportedCurrency.
--    - Drops old update triggers and installs strict append-only trigger (no updates or deletes).

-- Drop PaymentLogEvent table and triggers
DROP TRIGGER IF EXISTS "PaymentLogEvent_no_update_or_delete" ON "PaymentLogEvent";
DROP TRIGGER IF EXISTS "PaymentLogEvent_no_truncate" ON "PaymentLogEvent";
DROP FUNCTION IF EXISTS "payment_log_event_append_only"();
DROP TABLE IF EXISTS "PaymentLogEvent";

-- Drop old update/delete protection triggers on PaymentLog
DROP TRIGGER IF EXISTS "PaymentLog_protect_initiated" ON "PaymentLog";
DROP TRIGGER IF EXISTS "PaymentLog_no_truncate" ON "PaymentLog";
DROP FUNCTION IF EXISTS "payment_log_protect_initiated"();

-- Drop unique constraint on reference so multiple journey steps can share the same reference
ALTER TABLE "PaymentLog" DROP CONSTRAINT IF EXISTS "PaymentLog_reference_key";
DROP INDEX IF EXISTS "PaymentLog_reference_key";

-- Make initiated fields nullable for later journey events
ALTER TABLE "PaymentLog" ALTER COLUMN "memberId" DROP NOT NULL;
ALTER TABLE "PaymentLog" ALTER COLUMN "idempotencyKey" DROP NOT NULL;
ALTER TABLE "PaymentLog" ALTER COLUMN "purpose" DROP NOT NULL;
ALTER TABLE "PaymentLog" ALTER COLUMN "amountKobo" DROP NOT NULL;
ALTER TABLE "PaymentLog" ALTER COLUMN "currency" DROP NOT NULL;

-- Add event-specific columns
ALTER TABLE "PaymentLog"
  ADD COLUMN IF NOT EXISTS "type" "PaymentLogEventType" NOT NULL DEFAULT 'INITIATED',
  ADD COLUMN IF NOT EXISTS "reason" "PaymentLogEventReason",
  ADD COLUMN IF NOT EXISTS "reportedAmountKobo" INTEGER,
  ADD COLUMN IF NOT EXISTS "reportedCurrency" TEXT;

ALTER TABLE "PaymentLog" ALTER COLUMN "type" DROP DEFAULT;

-- Add journey indexes
CREATE INDEX IF NOT EXISTS "PaymentLog_reference_createdAt_idx" ON "PaymentLog"("reference", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentLog_memberId_createdAt_idx" ON "PaymentLog"("memberId", "createdAt");

-- PaymentLog is now strictly append-only: no updates, deletes, or truncates are ever allowed
CREATE OR REPLACE FUNCTION "payment_log_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PaymentLog is append only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "PaymentLog_no_update_or_delete" ON "PaymentLog";
CREATE TRIGGER "PaymentLog_no_update_or_delete"
  BEFORE UPDATE OR DELETE ON "PaymentLog"
  FOR EACH ROW EXECUTE FUNCTION "payment_log_append_only"();

DROP TRIGGER IF EXISTS "PaymentLog_no_truncate" ON "PaymentLog";
CREATE TRIGGER "PaymentLog_no_truncate"
  BEFORE TRUNCATE ON "PaymentLog"
  FOR EACH STATEMENT EXECUTE FUNCTION "payment_log_append_only"();
