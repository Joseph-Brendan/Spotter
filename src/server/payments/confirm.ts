import "server-only";
import { env } from "@/lib/env";
import { prisma } from "@/server/db";
import type { Tier } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PaymentVerificationEvidence {
  gatewayTransactionId: string;
  gatewayReference: string;
  gatewayStatus: string;
  verifiedAmountKobo: number;
  verifiedCurrency: string;
  webhookReceivedAt: Date;
}

export interface ConfirmPaymentInput {
  paymentLogId: string;
  evidence: PaymentVerificationEvidence;
  paidAt?: Date;
  simulated?: boolean;
}

export async function confirmPayment(input: ConfirmPaymentInput): Promise<void> {
  if (input.simulated && env.NODE_ENV === "production") {
    throw new Error("A simulated payment cannot be confirmed in production.");
  }

  const log = await prisma.paymentLog.findUnique({
    where: { id: input.paymentLogId },
    include: {
      member: {
        select: {
          id: true,
          gymId: true,
          tier: true,
          expiryDate: true,
        },
      },
    },
  });

  if (!log) {
    throw new Error("Payment log not found.");
  }

  if (log.status === "SUCCESS") {
    return;
  }

  assertVerificationEvidence(log, input.evidence, input.simulated === true);

  const member = log.member;
  const now = new Date();
  const paidAt = input.paidAt ?? now;

  let targetTier: Tier = member.tier;
  let durationDays = 30;

  if (log.purpose === "RENEWAL") {
    const plan = await prisma.membershipPlan.findFirst({
      where: {
        gymId: member.gymId,
        priceKobo: log.amountKobo,
      },
      select: {
        tier: true,
        durationDays: true,
      },
    });

    if (plan) {
      targetTier = plan.tier;
      durationDays = plan.durationDays;
    }
  }

  const baseDate =
    member.expiryDate && member.expiryDate.getTime() > paidAt.getTime()
      ? member.expiryDate
      : paidAt;
  const newExpiryDate = new Date(baseDate.getTime() + durationDays * DAY_MS);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.paymentLog.updateMany({
      where: { id: log.id, status: { not: "SUCCESS" } },
      data: {
        status: "SUCCESS",
        gatewayTransactionId: input.evidence.gatewayTransactionId,
        gatewayReference: input.evidence.gatewayReference,
        gatewayStatus: input.evidence.gatewayStatus,
        verifiedAt: now,
        verifiedAmountKobo: input.evidence.verifiedAmountKobo,
        verifiedCurrency: input.evidence.verifiedCurrency,
        webhookReceivedAt: input.evidence.webhookReceivedAt,
        verificationError: null,
        resolvedAt: now,
      },
    });

    if (updated.count === 0) {
      return;
    }

    const payment = await tx.payment.create({
      data: {
        memberId: member.id,
        attemptId: log.id,
        reference: log.reference,
        gatewayReference: input.evidence.gatewayReference,
        amountKobo: log.amountKobo,
        currency: log.currency,
        purpose: log.purpose,
        channel: "IN_APP",
        paidAt,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        memberId: member.id,
        paymentId: payment.id,
        amountKobo: -log.amountKobo,
        channel: "IN_APP",
        reason: `${log.purpose} payment (${log.reference})`,
        occurredAt: paidAt,
      },
    });

    if (log.purpose === "RENEWAL") {
      await tx.member.update({
        where: { id: member.id },
        data: {
          tier: targetTier,
          expiryDate: newExpiryDate,
        },
      });

      await tx.membershipChange.create({
        data: {
          memberId: member.id,
          paymentId: payment.id,
          oldTier: member.tier,
          newTier: targetTier,
          oldExpiryDate: member.expiryDate,
          newExpiryDate,
          reason: log.reference,
        },
      });
    }
  });
}

function assertVerificationEvidence(
  log: { amountKobo: number; currency: string },
  evidence: PaymentVerificationEvidence,
  simulated: boolean
): void {
  if (!evidence.gatewayTransactionId || !evidence.gatewayReference) {
    throw new Error("Payment verification evidence is incomplete.");
  }

  if (!simulated && evidence.gatewayStatus !== "successful") {
    throw new Error("Payment was not verified as successful.");
  }

  if (evidence.verifiedAmountKobo !== log.amountKobo) {
    throw new Error("Verified amount does not match the payment log.");
  }

  if (evidence.verifiedCurrency !== log.currency) {
    throw new Error("Verified currency does not match the payment log.");
  }
}
