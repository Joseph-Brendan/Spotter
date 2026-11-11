-- Backfill late claims that happened before the signup write path began
-- stamping MemberNumberReservation.claimedAt. Safe to rerun: only null rows
-- with an existing account are updated.
UPDATE "MemberNumberReservation" AS r
SET "claimedAt" = m."accountCreatedAt"
FROM "Member" AS m
WHERE r."gymId" = m."gymId"
  AND r."memberNumber" = m."memberNumber"
  AND m."accountCreatedAt" IS NOT NULL
  AND r."claimedAt" IS NULL;
