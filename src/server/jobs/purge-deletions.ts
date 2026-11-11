import "server-only";
import { prisma } from "@/server/db";

const DELETION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const DELETED_MEMBER_NAME = "Deleted member";

export async function purgeExpiredDeletions(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - DELETION_GRACE_MS);

  const members = await prisma.member.findMany({
    where: { deletionRequestedAt: { not: null, lte: cutoff }, deletedAt: null },
    select: { id: true },
  });

  for (const member of members) {
    await purgeMember(member.id, now);
  }

  return members.length;
}

async function purgeMember(memberId: string, now: Date): Promise<void> {
  await prisma.$transaction([
    prisma.wrongAnswerReport.deleteMany({ where: { questionLog: { memberId } } }),
    prisma.answerAudit.deleteMany({ where: { questionLog: { memberId } } }),
    prisma.questionLog.deleteMany({ where: { memberId } }),
    prisma.checkIn.deleteMany({ where: { memberId } }),
    prisma.checkInCode.deleteMany({ where: { memberId } }),
    prisma.memberSession.deleteMany({ where: { memberId } }),
    prisma.privateAccessLog.deleteMany({
      where: { OR: [{ sessionMemberId: memberId }, { targetMemberId: memberId }] },
    }),
    prisma.staffMemberAccessLog.deleteMany({ where: { memberId } }),
    prisma.member.update({
      where: { id: memberId },
      data: {
        name: DELETED_MEMBER_NAME,
        email: null,
        phone: null,
        passwordHash: null,
        tempPasswordHash: null,
        tempPasswordExpiresAt: null,
        emailVerifiedAt: null,
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        deletedAt: now,
      },
    }),
  ]);
}
