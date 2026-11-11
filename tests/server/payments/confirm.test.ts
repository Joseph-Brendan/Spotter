import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { confirmPayment } from "@/server/payments/confirm";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!hasTestDatabase)("confirmPayment", () => {
  beforeEach(async () => {
    await prisma.ledgerEntry.deleteMany();
    await prisma.membershipChange.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.paymentLog.deleteMany();
    await prisma.membershipPlan.deleteMany();
    await prisma.memberSession.deleteMany();
    await prisma.member.deleteMany();
    await prisma.gym.deleteMany();
  });

  async function createJourney() {
    const gym = await prisma.gym.create({
      data: {
        name: "Test Gym",
        timezone: "Africa/Lagos",
        openingTime: "06:00",
        closingTime: "22:00",
        graceDays: 3,
      },
    });

    const paidAt = new Date("2026-10-28T12:00:00.000Z");
    const expiryDate = new Date(paidAt.getTime() + 10 * DAY_MS);

    const member = await prisma.member.create({
      data: {
        gymId: gym.id,
        name: "Ada",
        memberNumber: "500001",
        tier: "PREMIUM",
        expiryDate,
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

    const log = await prisma.paymentLog.create({
      data: {
        memberId: member.id,
        idempotencyKey: "confirm-payment-test",
        reference: "confirm-payment-reference",
        type: "INITIATED",
        purpose: "RENEWAL",
        amountKobo: 1_500_000,
        currency: "NGN",
      },
    });

    return { member, log, paidAt, expiryDate };
  }

  it("confirms once from a verified log and records the evidence", async () => {
    const { member, log, paidAt, expiryDate } = await createJourney();

    const evidence = {
      gatewayTransactionId: "1163068",
      gatewayReference: "FLW-M03K-test",
      gatewayStatus: "successful",
      verifiedAmountKobo: 1_500_000,
      verifiedCurrency: "NGN",
      webhookReceivedAt: paidAt,
    };

    await confirmPayment({ reference: log.reference, evidence, paidAt });
    await confirmPayment({ reference: log.reference, evidence, paidAt });

    const confirmedLog = await prisma.paymentLog.findFirstOrThrow({
      where: { reference: log.reference, type: "CONFIRMED" },
    });

    expect(confirmedLog.status).toBe("SUCCESS");
    expect(confirmedLog.gatewayTransactionId).toBe("1163068");
    expect(confirmedLog.gatewayReference).toBe("FLW-M03K-test");
    expect(confirmedLog.gatewayStatus).toBe("successful");
    expect(confirmedLog.reportedAmountKobo).toBe(1_500_000);
    expect(confirmedLog.reportedCurrency).toBe("NGN");

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { attemptId: confirmedLog.id },
    });

    expect(payment.amountKobo).toBe(1_500_000);
    expect(payment.channel).toBe("IN_APP");
    expect(payment.gatewayReference).toBe("FLW-M03K-test");

    const ledger = await prisma.ledgerEntry.findMany({
      where: { memberId: member.id },
    });

    expect(ledger).toHaveLength(1);
    expect(ledger[0].amountKobo).toBe(-1_500_000);

    const change = await prisma.membershipChange.findFirstOrThrow({
      where: { memberId: member.id },
    });

    expect(change.oldExpiryDate?.toISOString()).toBe(expiryDate.toISOString());
    expect(change.newExpiryDate?.toISOString()).toBe(
      new Date(expiryDate.getTime() + 30 * DAY_MS).toISOString()
    );

    const savedMember = await prisma.member.findUniqueOrThrow({
      where: { id: member.id },
    });

    expect(savedMember.expiryDate?.toISOString()).toBe(
      new Date(expiryDate.getTime() + 30 * DAY_MS).toISOString()
    );
  });

  it("refuses evidence whose amount does not match the log", async () => {
    const { log, paidAt } = await createJourney();

    await expect(
      confirmPayment({
        reference: log.reference,
        evidence: {
          gatewayTransactionId: "1163069",
          gatewayReference: "FLW-M03K-test-mismatch",
          gatewayStatus: "successful",
          verifiedAmountKobo: 1_400_000,
          verifiedCurrency: "NGN",
          webhookReceivedAt: paidAt,
        },
        paidAt,
      })
    ).rejects.toThrow("Verified amount does not match the payment log.");

    expect(await prisma.payment.count()).toBe(0);

    const confirmedCount = await prisma.paymentLog.count({
      where: { reference: log.reference, type: "CONFIRMED" },
    });

    expect(confirmedCount).toBe(0);
  });

  it("refuses a gateway status that is not successful", async () => {
    const { log, paidAt } = await createJourney();

    await expect(
      confirmPayment({
        reference: log.reference,
        evidence: {
          gatewayTransactionId: "1163070",
          gatewayReference: "FLW-M03K-test-failed",
          gatewayStatus: "failed",
          verifiedAmountKobo: 1_500_000,
          verifiedCurrency: "NGN",
          webhookReceivedAt: paidAt,
        },
        paidAt,
      })
    ).rejects.toThrow("Payment was not verified as successful.");

    expect(await prisma.payment.count()).toBe(0);
  });
});
