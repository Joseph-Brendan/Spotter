-- Record the full payment journey.
--
-- 1. PaymentLog gains a plan snapshot taken when the payment starts.
-- 2. PaymentLogEvent holds one row per journey step and is append only.
-- 3. Triggers make the append only rule and the immutable initiated fields
--    hold in the database, not only in application code.

-- CreateEnum
CREATE TYPE "PaymentLogEventType" AS ENUM (
  'INITIATED',
  'GATEWAY_INIT_SUCCEEDED',
  'GATEWAY_INIT_FAILED',
  'WEBHOOK_RECEIVED',
  'WEBHOOK_REJECTED',
  'VERIFY_FAILED',
  'VERIFY_MISMATCH',
  'GATEWAY_PENDING',
  'GATEWAY_FAILED',
  'CONFIRMED',
  'ABANDONED'
);

-- CreateEnum
CREATE TYPE "PaymentLogEventReason" AS ENUM (
  'HTTP_ERROR',
  'NETWORK_ERROR',
  'NO_LINK',
  'MISSING_HASH',
  'BAD_HASH',
  'SECRET_NOT_CONFIGURED',
  'BAD_BODY',
  'MISSING_TX_REF',
  'UNKNOWN_REFERENCE',
  'MISSING_TRANSACTION_ID',
  'VERIFY_NOT_CONFIGURED',
  'VERIFY_REQUEST_FAILED',
  'DETAILS_MISMATCH',
  'PLAN_SNAPSHOT_MISSING',
  'PENDING_TIMEOUT'
);

-- AlterTable
ALTER TABLE "PaymentLog"
  ADD COLUMN "planTier" "Tier",
  ADD COLUMN "planDurationDays" INTEGER;

-- CreateTable
CREATE TABLE "PaymentLogEvent" (
  "id" TEXT NOT NULL,
  "paymentLogId" TEXT,
  "memberId" TEXT,
  "type" "PaymentLogEventType" NOT NULL,
  "reason" "PaymentLogEventReason",
  "statusBefore" "PaymentStatus",
  "statusAfter" "PaymentStatus",
  "gatewayTransactionId" TEXT,
  "gatewayReference" TEXT,
  "gatewayStatus" TEXT,
  "reportedTxRef" TEXT,
  "reportedAmountKobo" INTEGER,
  "reportedCurrency" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentLogEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PaymentLogEvent" ADD CONSTRAINT "PaymentLogEvent_paymentLogId_fkey"
  FOREIGN KEY ("paymentLogId") REFERENCES "PaymentLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLogEvent" ADD CONSTRAINT "PaymentLogEvent_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append only: no row in PaymentLogEvent is ever updated, deleted or truncated.
CREATE FUNCTION "payment_log_event_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PaymentLogEvent is append only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentLogEvent_no_update_or_delete"
  BEFORE UPDATE OR DELETE ON "PaymentLogEvent"
  FOR EACH ROW EXECUTE FUNCTION "payment_log_event_append_only"();

CREATE TRIGGER "PaymentLogEvent_no_truncate"
  BEFORE TRUNCATE ON "PaymentLogEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION "payment_log_event_append_only"();

-- A payment log is never deleted, and its initiated fields are never edited.
-- Status, verification evidence and resolution stay writable; application code
-- moves them forward only.
CREATE FUNCTION "payment_log_protect_initiated"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'PaymentLog rows are never deleted';
  END IF;

  IF NEW."memberId" IS DISTINCT FROM OLD."memberId"
    OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
    OR NEW."reference" IS DISTINCT FROM OLD."reference"
    OR NEW."purpose" IS DISTINCT FROM OLD."purpose"
    OR NEW."amountKobo" IS DISTINCT FROM OLD."amountKobo"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."planTier" IS DISTINCT FROM OLD."planTier"
    OR NEW."planDurationDays" IS DISTINCT FROM OLD."planDurationDays"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  THEN
    RAISE EXCEPTION 'PaymentLog initiated fields cannot be edited';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentLog_protect_initiated"
  BEFORE UPDATE OR DELETE ON "PaymentLog"
  FOR EACH ROW EXECUTE FUNCTION "payment_log_protect_initiated"();

CREATE TRIGGER "PaymentLog_no_truncate"
  BEFORE TRUNCATE ON "PaymentLog"
  FOR EACH STATEMENT EXECUTE FUNCTION "payment_log_protect_initiated"();
