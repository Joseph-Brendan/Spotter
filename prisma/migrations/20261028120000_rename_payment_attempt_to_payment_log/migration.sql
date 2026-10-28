-- Replace the payment attempt table with the payment log and add the columns
-- that record the payment journey and the gateway verification evidence.
--
-- The Payment table is not changed. Its attemptId column and its foreign key
-- keep their names; only the table they point at is renamed.

ALTER TABLE "PaymentAttempt" RENAME TO "PaymentLog";

ALTER TABLE "PaymentLog" RENAME CONSTRAINT "PaymentAttempt_pkey" TO "PaymentLog_pkey";
ALTER TABLE "PaymentLog" RENAME CONSTRAINT "PaymentAttempt_memberId_fkey" TO "PaymentLog_memberId_fkey";

ALTER INDEX "PaymentAttempt_idempotencyKey_key" RENAME TO "PaymentLog_idempotencyKey_key";
ALTER INDEX "PaymentAttempt_reference_key" RENAME TO "PaymentLog_reference_key";
ALTER INDEX "PaymentAttempt_memberId_status_idx" RENAME TO "PaymentLog_memberId_status_idx";

ALTER TABLE "PaymentLog"
  ADD COLUMN "gatewayInitiatedAt" TIMESTAMP(3),
  ADD COLUMN "checkoutUrl" TEXT,
  ADD COLUMN "webhookReceivedAt" TIMESTAMP(3),
  ADD COLUMN "gatewayTransactionId" TEXT,
  ADD COLUMN "gatewayReference" TEXT,
  ADD COLUMN "gatewayStatus" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedAmountKobo" INTEGER,
  ADD COLUMN "verifiedCurrency" TEXT,
  ADD COLUMN "verificationError" TEXT;
