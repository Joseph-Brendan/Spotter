import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getMemberPaymentQuote } from "@/server/private/payment-quote";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!hasTestDatabase)("member payment quote", () => {
  beforeEach(async () => {
    await prisma.privateAccessLog.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.membershipPlan.deleteMany();
    await prisma.member.deleteMany();
    await prisma.gym.deleteMany();
  });

  async function createMember(tier: "BASIC" | "PREMIUM" = "PREMIUM") {
    const gym = await prisma.gym.create({
      data: {
        name: "Test Gym",
        timezone: "Africa/Lagos",
        openingTime: "06:00",
        closingTime: "22:00",
        graceDays: 3,
      },
    });

    const member = await prisma.member.create({
      data: {
        gymId: gym.id,
        name: "Ada",
        memberNumber: "400001",
        tier,
        expiryDate: new Date(Date.now() + 10 * DAY_MS),
      },
    });

    return { gym, member };
  }

  it("uses the plan price for a renewal", async () => {
    const { gym, member } = await createMember();

    await prisma.membershipPlan.create({
      data: {
        gymId: gym.id,
        tier: "PREMIUM",
        priceKobo: 1_500_000,
        durationDays: 30,
      },
    });

    expect(await getMemberPaymentQuote(member.id, "RENEWAL")).toEqual({
      purpose: "RENEWAL",
      tier: "PREMIUM",
      amountKobo: 1_500_000,
    });
    expect(await prisma.privateAccessLog.count()).toBe(1);
  });

  it("uses the price of the plan the member chooses", async () => {
    const { gym, member } = await createMember("BASIC");

    await prisma.membershipPlan.createMany({
      data: [
        {
          gymId: gym.id,
          tier: "BASIC",
          priceKobo: 1_000_000,
          durationDays: 30,
        },
        {
          gymId: gym.id,
          tier: "PREMIUM",
          priceKobo: 2_000_000,
          durationDays: 30,
        },
      ],
    });

    expect(
      await getMemberPaymentQuote(member.id, "RENEWAL", "PREMIUM")
    ).toEqual({
      purpose: "RENEWAL",
      tier: "PREMIUM",
      amountKobo: 2_000_000,
    });
    expect(await prisma.privateAccessLog.count()).toBe(1);
  });

  it("uses the ledger sum for arrears", async () => {
    const { member } = await createMember();

    await prisma.ledgerEntry.create({
      data: {
        memberId: member.id,
        amountKobo: 700_000,
        reason: "Charge",
        occurredAt: new Date(),
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        memberId: member.id,
        amountKobo: -200_000,
        reason: "Payment",
        occurredAt: new Date(),
      },
    });

    expect(await getMemberPaymentQuote(member.id, "ARREARS")).toEqual({
      purpose: "ARREARS",
      tier: "PREMIUM",
      amountKobo: 500_000,
    });
    expect(await prisma.privateAccessLog.count()).toBe(1);
  });

  it("returns null when there is nothing to pay", async () => {
    const { member } = await createMember();

    expect(await getMemberPaymentQuote(member.id, "RENEWAL")).toBeNull();
    expect(await prisma.privateAccessLog.count()).toBe(1);
  });
});
