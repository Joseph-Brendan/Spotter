import "server-only";
import { env } from "@/lib/env";
import { prisma } from "@/server/db";
import { getMemberPaymentQuote } from "@/server/private/payment-quote";
import type { PaymentPurpose } from "@/types/payments";
import type { Tier } from "@prisma/client";
import { confirmPayment } from "./confirm";

export interface InitiatePaymentResult {
  checkoutUrl?: string;
  error?: "MEMBER_NOT_FOUND" | "QUOTE_NOT_FOUND" | "GATEWAY_ERROR";
}

export async function initiateMemberPayment(input: {
  memberId: string;
  purpose: PaymentPurpose;
  tier?: Tier;
  idempotencyKey: string;
}): Promise<InitiatePaymentResult> {
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: {
      id: true,
      gymId: true,
      email: true,
      name: true,
      phone: true,
    },
  });

  if (!member) {
    return { error: "MEMBER_NOT_FOUND" };
  }

  const quote = await getMemberPaymentQuote(
    member.id,
    input.purpose,
    input.tier
  );

  if (!quote) {
    return { error: "QUOTE_NOT_FOUND" };
  }

  const existingLog = await prisma.paymentLog.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { payment: true },
  });

  if (existingLog && existingLog.status === "SUCCESS") {
    return { checkoutUrl: "/?payment=confirmed" };
  }

  if (existingLog?.status === "PENDING" && existingLog.checkoutUrl) {
    return { checkoutUrl: existingLog.checkoutUrl };
  }

  const reference =
    existingLog?.reference ??
    `spotter_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const log =
    existingLog ??
    (await prisma.paymentLog.create({
      data: {
        memberId: member.id,
        idempotencyKey: input.idempotencyKey,
        reference,
        purpose: quote.purpose,
        amountKobo: quote.amountKobo,
        currency: "NGN",
        status: "PENDING",
      },
    }));

  const secretKey = env.FLUTTERWAVE_SECRET_KEY;
  const appUrl = env.APP_URL || "http://localhost:3000";

  if (secretKey) {
    try {
      const response = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: reference,
          amount: (quote.amountKobo / 100).toFixed(2),
          currency: "NGN",
          redirect_url: `${appUrl}/api/payments/callback`,
          customer: {
            email: member.email ?? `${member.id}@spotter.local`,
            name: member.name ?? "Member",
            phonenumber: member.phone ?? undefined,
          },
          customizations: {
            title: "Spotter Gym Membership",
            description: `${quote.tier} plan subscription`,
          },
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          status: string;
          data?: { link?: string };
        };

        if (data.status === "success" && data.data?.link) {
          await prisma.paymentLog.update({
            where: { id: log.id },
            data: {
              gatewayInitiatedAt: new Date(),
              checkoutUrl: data.data.link,
            },
          });

          return { checkoutUrl: data.data.link };
        }
      }

      return { error: "GATEWAY_ERROR" };
    } catch {
      return { error: "GATEWAY_ERROR" };
    }
  }

  if (env.NODE_ENV === "production") {
    return { error: "GATEWAY_ERROR" };
  }

  // In local development when no Flutterwave key is provided,
  // confirm the in-app payment directly so payment can be tested end-to-end.
  const paidAt = new Date();

  await confirmPayment({
    paymentLogId: log.id,
    evidence: {
      gatewayTransactionId: `local_${log.reference}`,
      gatewayReference: `local_${log.reference}`,
      gatewayStatus: "simulated",
      verifiedAmountKobo: quote.amountKobo,
      verifiedCurrency: "NGN",
      webhookReceivedAt: paidAt,
    },
    paidAt,
    simulated: true,
  });

  return { checkoutUrl: "/?payment=confirmed" };
}
