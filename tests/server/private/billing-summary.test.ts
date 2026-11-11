import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getMemberBillingSummary } from "@/server/private/billing-summary";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!hasTestDatabase)("member billing summary", () => {
  beforeEach(async () => {
    await prisma.privateAccessLog.deleteMany();
    await prisma.paymentLog.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.checkIn.deleteMany();
    await prisma.membershipPlan.deleteMany();
    await prisma.memberSession.deleteMany();
    await prisma.member.deleteMany();
    await prisma.gym.deleteMany();
  });

  it("reads only the requested member and writes an access log", async () => {
    const now = new Date();
    const gym = await prisma.gym.create({
      data: {
        name: "Test Gym",
        timezone: "UTC",
        openingTime: "06:00",
        closingTime: "22:00",
        graceDays: 3,
      },
    });

    const member = await prisma.member.create({
      data: {
        gymId: gym.id,
        name: "Ada",
        memberNumber: "300001",
        tier: "PREMIUM",
        expiryDate: new Date(now.getTime() + 10 * DAY_MS),
      },
    });

    const other = await prisma.member.create({
      data: {
        gymId: gym.id,
        name: "Bola",
        memberNumber: "300002",
        tier: "BASIC",
        expiryDate: new Date(now.getTime() + 10 * DAY_MS),
      },
    });

    await prisma.membershipPlan.create({
      data: {
        gymId: gym.id,
        tier: "PREMIUM",
        priceKobo: 1_500_000,
        durationDays: 30,
      },
    });

    await prisma.ledgerEntry.create({
      data: {
        memberId: member.id,
        amountKobo: 1_500_000,
        reason: "Charge",
        occurredAt: now,
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        memberId: member.id,
        amountKobo: -500_000,
        reason: "Payment",
        occurredAt: now,
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        memberId: other.id,
        amountKobo: 9_999_999,
        reason: "Other member charge",
        occurredAt: now,
      },
    });

    await prisma.checkIn.create({
      data: {
        memberId: member.id,
        date: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
        ),
        source: "CODE",
      },
    });
    await prisma.checkIn.create({
      data: {
        memberId: other.id,
        date: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
        ),
        source: "CODE",
      },
    });

    const summary = await getMemberBillingSummary(member.id);

    expect(summary.status).toBe("active");
    expect(summary.storedTier).toBe("PREMIUM");
    expect(summary.effectiveTier).toBe("PREMIUM");
    expect(summary.daysTrainedThisMonth).toBe(1);
    expect(summary.balanceKobo).toBe(1_000_000);
    expect(summary.plan?.priceKobo).toBe(1_500_000);
    expect(summary.availablePlans).toEqual([
      { tier: "PREMIUM", priceKobo: 1_500_000, durationDays: 30 },
    ]);

    const logs = await prisma.privateAccessLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0].sessionMemberId).toBe(member.id);
    expect(logs[0].targetMemberId).toBe(member.id);
    expect(logs[0].functionName).toBe("getMemberBillingSummary");
  });
});
