-- A member has no plan until a payment is confirmed. BASIC was only the column
-- default, so members who have never paid (no expiry date) are cleared.
ALTER TABLE "Member" ALTER COLUMN "tier" DROP DEFAULT;
ALTER TABLE "Member" ALTER COLUMN "tier" DROP NOT NULL;

UPDATE "Member"
SET "tier" = NULL
WHERE "expiryDate" IS NULL;
