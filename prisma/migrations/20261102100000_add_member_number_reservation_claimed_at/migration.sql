-- Add a claim timestamp so the staff dashboard can show which generated
-- member numbers have been used to create an account. The dashboard reads
-- this reservation column only; it never reads the private Member table.
ALTER TABLE "MemberNumberReservation" ADD COLUMN "claimedAt" TIMESTAMP(3);

-- Backfill existing reservations from accounts that were already created.
UPDATE "MemberNumberReservation" AS r
SET "claimedAt" = m."accountCreatedAt"
FROM "Member" AS m
WHERE r."gymId" = m."gymId"
  AND r."memberNumber" = m."memberNumber"
  AND m."accountCreatedAt" IS NOT NULL
  AND r."claimedAt" IS NULL;
