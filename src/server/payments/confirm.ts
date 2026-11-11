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
  reference: string;
  evidence: PaymentVerificationEvidence;
  paidAt?: Date;
  simulated?: boolean;
}

export async function confirmPayment(input: ConfirmPaymentInput): Promise<void> {
  if (input.simulated && env.NODE_ENV === "production") {
    throw new Error("A simulated payment cannot be confirmed in production.");
  }

  const initiatedLog = await prisma.paymentLog.findFirst({
    where: { reference: input.reference, type: "INITIATED" },
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

  if (!initiatedLog || !initiatedLog.member) {
    throw new Error("Initiated payment log not found.");
  }

  const alreadyConfirmed = await prisma.paymentLog.findFirst({
    where: { reference: input.reference, type: "CONFIRMED" },
  });

  const existingPayment = await prisma.payment.findUnique({
    where: { reference: input.reference },
  });

  if (alreadyConfirmed || existingPayment) {
    return;
  }

  assertVerificationEvidence(
    {
      amountKobo: initiatedLog.amountKobo ?? 0,
      currency: initiatedLog.currency ?? "NGN",
    },
    input.evidence,
    input.simulated === true
  );

  const member = initiatedLog.member;
  const now = new Date();
  const paidAt = input.paidAt ?? now;

  let targetTier: Tier | null = member.tier;
  let durationDays = 30;

  if (initiatedLog.purpose === "RENEWAL") {
    if (initiatedLog.planTier && initiatedLog.planDurationDays) {
      targetTier = initiatedLog.planTier;
      durationDays = initiatedLog.planDurationDays;
    } else {
      const plan = await prisma.membershipPlan.findFirst({
        where: {
          gymId: member.gymId,
          priceKobo: initiatedLog.amountKobo ?? 0,
        },
        select: {
          tier: true,
          durationDays: true,
        },
      });

      if (plan) {
        targetTier = plan.tier;
        durationDays = plan.durationDays;
      } else {
        await prisma.paymentLog.create({
          data: {
            reference: input.reference,
            memberId: member.id,
            type: "VERIFY_FAILED",
            reason: "PLAN_SNAPSHOT_MISSING",
            status: "PENDING",
            gatewayTransactionId: input.evidence.gatewayTransactionId,
            gatewayReference: input.evidence.gatewayReference,
            gatewayStatus: input.evidence.gatewayStatus,
            reportedAmountKobo: input.evidence.verifiedAmountKobo,
            reportedCurrency: input.evidence.verifiedCurrency,
          },
        });
        throw new Error(
          "Cannot auto-confirm renewal: plan snapshot is missing on payment log."
        );
      }
    }
  }

  const baseDate =
    member.expiryDate && member.expiryDate.getTime() > paidAt.getTime()
      ? member.expiryDate
      : paidAt;
  const newExpiryDate = new Date(baseDate.getTime() + durationDays * DAY_MS);

  await prisma.$transaction(async (tx) => {
    const existingConfirmed = await tx.paymentLog.findFirst({
      where: { reference: input.reference, type: "CONFIRMED" },
    });

    const paymentExists = await tx.payment.findUnique({
      where: { reference: input.reference },
    });

    if (existingConfirmed || paymentExists) {
      return;
    }

    const confirmedLog = await tx.paymentLog.create({
      data: {
        reference: input.reference,
        memberId: member.id,
        type: "CONFIRMED",
        status: "SUCCESS",
        purpose: initiatedLog.purpose,
        amountKobo: initiatedLog.amountKobo,
        currency: initiatedLog.currency,
        planTier: targetTier,
        planDurationDays: durationDays,
        gatewayTransactionId: input.evidence.gatewayTransactionId,
        gatewayReference: input.evidence.gatewayReference,
        gatewayStatus: input.evidence.gatewayStatus,
        reportedAmountKobo: input.evidence.verifiedAmountKobo,
        reportedCurrency: input.evidence.verifiedCurrency,
      },
    });

    const payment = await tx.payment.create({
      data: {
        memberId: member.id,
        attemptId: confirmedLog.id,
        reference: input.reference,
        gatewayReference: input.evidence.gatewayReference,
        amountKobo:
          initiatedLog.amountKobo ?? input.evidence.verifiedAmountKobo,
        currency: initiatedLog.currency ?? input.evidence.verifiedCurrency,
        purpose: initiatedLog.purpose ?? "RENEWAL",
        channel: "IN_APP",
        paidAt,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        memberId: member.id,
        paymentId: payment.id,
        amountKobo: -(
          initiatedLog.amountKobo ?? input.evidence.verifiedAmountKobo
        ),
        channel: "IN_APP",
        reason: `${initiatedLog.purpose} payment (${input.reference})`,
        occurredAt: paidAt,
      },
    });

    if (initiatedLog.purpose === "RENEWAL") {
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
          reason: input.reference,
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
