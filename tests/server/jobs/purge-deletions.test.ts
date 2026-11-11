import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { purgeExpiredDeletions } from "@/server/jobs/purge-deletions";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function createGym() {
  return prisma.gym.create({
    data: {
      name: "Test Gym",
      timezone: "Africa/Lagos",
      openingTime: "06:00",
      closingTime: "22:00",
      graceDays: 7,
    },
  });
}

async function createMember(
  gymId: string,
  memberNumber: string,
  deletionRequestedAt: Date | null
) {
  return prisma.member.create({
    data: {
      gymId,
      name: "Scheduled Member",
      memberNumber,
      expiryDate: new Date("2027-01-01"),
      email: `member-${memberNumber}@example.com`,
      passwordHash: "stored-hash",
      phone: "+2348000000000",
      accountCreatedAt: new Date("2026-01-01"),
      deletionRequestedAt,
    },
  });
}

describe.skipIf(!hasTestDatabase)("purgeExpiredDeletions", () => {
  beforeEach(async () => {
    await prisma.privateAccessLog.deleteMany();
    await prisma.answerAudit.deleteMany();
    await prisma.wrongAnswerReport.deleteMany();
    await prisma.questionLog.deleteMany();
    await prisma.checkIn.deleteMany();
    await prisma.checkInCode.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.membershipChange.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.paymentLog.deleteMany();
    await prisma.memberSession.deleteMany();
    await prisma.member.deleteMany();
    await prisma.gym.deleteMany();
  });

  it("anonymizes a member past the window and keeps money rows", async () => {
    const gym = await createGym();
    const member = await createMember(gym.id, "300001", new Date(Date.now() - 8 * ONE_DAY_MS));

    await prisma.memberSession.create({
      data: {
        memberId: member.id,
        tokenHash: `token-${member.id}`,
        expiresAt: new Date(Date.now() + ONE_DAY_MS),
      },
    });
    await prisma.checkInCode.create({
      data: { memberId: member.id, code: "300001", expiresAt: new Date(Date.now() + 60_000) },
    });
    await prisma.checkIn.create({
      data: { memberId: member.id, date: new Date("2026-05-01"), source: "MANUAL" },
    });
    const questionLog = await prisma.questionLog.create({
      data: {
        memberId: member.id,
        question: "When is the class?",
        intent: "UNCLEAR",
        outcome: "REFUSED_NO_RECORD",
      },
    });
    await prisma.wrongAnswerReport.create({ data: { questionLogId: questionLog.id } });
    await prisma.privateAccessLog.create({
      data: { sessionMemberId: member.id, targetMemberId: member.id, functionName: "test" },
    });
    await prisma.payment.create({
      data: {
        memberId: member.id,
        reference: `ref-${member.id}`,
        amountKobo: 50_000,
        purpose: "RENEWAL",
        channel: "CASH",
        paidAt: new Date("2026-04-01"),
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        memberId: member.id,
        amountKobo: -50_000,
        reason: "Payment",
        occurredAt: new Date("2026-04-01"),
      },
    });

    expect(await purgeExpiredDeletions()).toBe(1);

    const row = await prisma.member.findUnique({ where: { id: member.id } });
    expect(row?.name).toBe("Deleted member");
    expect(row?.email).toBeNull();
    expect(row?.passwordHash).toBeNull();
    expect(row?.phone).toBeNull();
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.accountCreatedAt).not.toBeNull();

    expect(await prisma.memberSession.count({ where: { memberId: member.id } })).toBe(0);
    expect(await prisma.checkInCode.count({ where: { memberId: member.id } })).toBe(0);
    expect(await prisma.checkIn.count({ where: { memberId: member.id } })).toBe(0);
    expect(await prisma.questionLog.count({ where: { memberId: member.id } })).toBe(0);
    expect(await prisma.wrongAnswerReport.count()).toBe(0);
    expect(await prisma.privateAccessLog.count()).toBe(0);

    expect(await prisma.payment.count({ where: { memberId: member.id } })).toBe(1);
    expect(await prisma.ledgerEntry.count({ where: { memberId: member.id } })).toBe(1);

    expect(await purgeExpiredDeletions()).toBe(0);
  });

  it("leaves a member inside the window untouched", async () => {
    const gym = await createGym();
    const member = await createMember(gym.id, "300002", new Date(Date.now() - ONE_DAY_MS));

    await prisma.memberSession.create({
      data: {
        memberId: member.id,
        tokenHash: `token-${member.id}`,
        expiresAt: new Date(Date.now() + ONE_DAY_MS),
      },
    });

    expect(await purgeExpiredDeletions()).toBe(0);

    const row = await prisma.member.findUnique({ where: { id: member.id } });
    expect(row?.name).toBe("Scheduled Member");
    expect(row?.deletedAt).toBeNull();
    expect(await prisma.memberSession.count({ where: { memberId: member.id } })).toBe(1);
  });

  it("ignores members with no deletion request", async () => {
    const gym = await createGym();
    const member = await createMember(gym.id, "300003", null);

    expect(await purgeExpiredDeletions()).toBe(0);

    const row = await prisma.member.findUnique({ where: { id: member.id } });
    expect(row?.deletedAt).toBeNull();
  });
});
