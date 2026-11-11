-- Drop updatedAt from PaymentLog since PaymentLog is an append-only event table.
ALTER TABLE "PaymentLog" DROP COLUMN IF EXISTS "updatedAt";
