-- CreateTable
CREATE TABLE "OwnerReviewSnapshot" (
    "id" TEXT NOT NULL,
    "gymId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wrongAnswersCount" INTEGER NOT NULL DEFAULT 0,
    "unansweredCount" INTEGER NOT NULL DEFAULT 0,
    "blockedUngroundedCount" INTEGER NOT NULL DEFAULT 0,
    "abandonedPaymentsCount" INTEGER NOT NULL DEFAULT 0,
    "overdueCardsCount" INTEGER NOT NULL DEFAULT 0,
    "privacyExceptionsCount" INTEGER NOT NULL DEFAULT 0,
    "checkInSpikeDaysCount" INTEGER NOT NULL DEFAULT 0,
    "excessiveMemberCheckInsCount" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerReviewSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnerReviewSnapshot_gymId_computedAt_idx" ON "OwnerReviewSnapshot"("gymId", "computedAt");

-- CreateIndex
CREATE INDEX "AnswerAudit_questionLogId_idx" ON "AnswerAudit"("questionLogId");

-- AddForeignKey
ALTER TABLE "OwnerReviewSnapshot" ADD CONSTRAINT "OwnerReviewSnapshot_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SeedPermission for Owner Review Dashboard
INSERT INTO "Permission" ("id", "key", "description", "createdAt")
VALUES ('perm_owner_review_access', 'owner.review.access', 'Access the owner review dashboard.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Grant Permission to Owner Role
INSERT INTO "RolePermission" ("roleId", "permissionId")
VALUES ('role_owner', 'perm_owner_review_access')
ON CONFLICT DO NOTHING;
