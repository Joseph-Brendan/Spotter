-- Audit table for owner-only member detail reads from the staff dashboard.
CREATE TABLE "StaffMemberAccessLog" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "gymId" TEXT NOT NULL,
  "functionName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StaffMemberAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffMemberAccessLog_staffId_createdAt_idx"
  ON "StaffMemberAccessLog"("staffId", "createdAt");

CREATE INDEX "StaffMemberAccessLog_memberId_createdAt_idx"
  ON "StaffMemberAccessLog"("memberId", "createdAt");

CREATE INDEX "StaffMemberAccessLog_gymId_createdAt_idx"
  ON "StaffMemberAccessLog"("gymId", "createdAt");
