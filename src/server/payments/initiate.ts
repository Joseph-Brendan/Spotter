import "server-only";
import { copy } from "@/lib/copy";
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
  });

  if (existingLog) {
    const confirmed = await prisma.paymentLog.findFirst({
      where: { reference: existingLog.reference, type: "CONFIRMED" },
    });
    if (confirmed) {
      return { checkoutUrl: "/?payment=confirmed" };
    }

    const initSuccess = await prisma.paymentLog.findFirst({
      where: {
        reference: existingLog.reference,
        type: "GATEWAY_INIT_SUCCEEDED",
      },
      select: { checkoutUrl: true },
      orderBy: { createdAt: "desc" },
    });

    if (initSuccess?.checkoutUrl) {
      return { checkoutUrl: initSuccess.checkoutUrl };
    }
  }

  const reference =
    existingLog?.reference ??
    `spotter_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const planTier = quote.purpose === "RENEWAL" ? quote.tier : null;
  const planDurationDays =
    quote.purpose === "RENEWAL" ? quote.durationDays ?? 30 : null;

  if (!existingLog) {
    await prisma.paymentLog.create({
      data: {
        memberId: member.id,
        idempotencyKey: input.idempotencyKey,
        reference,
        type: "INITIATED",
        status: "PENDING",
        purpose: quote.purpose,
        amountKobo: quote.amountKobo,
        currency: "NGN",
        planTier,
        planDurationDays,
      },
    });
  }

  const secretKey = env.FLUTTERWAVE_SECRET_KEY;
  const appUrl = env.APP_URL || "http://localhost:3000";

  if (secretKey) {
    let response: Response;
    try {
      response = await fetch("https://api.flutterwave.com/v3/payments", {
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
            description: quote.tier
              ? `${quote.tier} plan subscription`
              : copy.payments.subscriptionTitle,
          },
        }),
      });
    } catch (err) {
      console.error(
        "[initiate] Flutterwave payment init request threw:",
        err instanceof Error ? err.message : err
      );
      await prisma.paymentLog.create({
        data: {
          reference,
          memberId: member.id,
          type: "GATEWAY_INIT_FAILED",
          reason: "NETWORK_ERROR",
          status: "PENDING",
          verificationError:
            err instanceof Error ? err.message : "Network error",
        },
      });
      return { error: "GATEWAY_ERROR" };
    }

    if (response.ok) {
      const data = (await response.json()) as {
        status: string;
        message?: string;
        data?: { link?: string };
      };

      if (data.status === "success" && data.data?.link) {
        await prisma.paymentLog.create({
          data: {
            reference,
            memberId: member.id,
            type: "GATEWAY_INIT_SUCCEEDED",
            status: "PENDING",
            checkoutUrl: data.data.link,
          },
        });

        return { checkoutUrl: data.data.link };
      }

      console.error(
        "[initiate] Flutterwave response missing link or unconfirmed:",
        data.message ?? data.status
      );

      await prisma.paymentLog.create({
        data: {
          reference,
          memberId: member.id,
          type: "GATEWAY_INIT_FAILED",
          reason: "NO_LINK",
          status: "PENDING",
          verificationError: data.message ?? data.status,
        },
      });
      return { error: "GATEWAY_ERROR" };
    }

    const errText = await response.text().catch(() => "");
    console.error(
      `[initiate] Flutterwave HTTP ${response.status}:`,
      errText
    );

    await prisma.paymentLog.create({
      data: {
        reference,
        memberId: member.id,
        type: "GATEWAY_INIT_FAILED",
        reason: "HTTP_ERROR",
        status: "PENDING",
        verificationError: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
      },
    });
    return { error: "GATEWAY_ERROR" };
  }

  if (env.NODE_ENV === "production") {
    return { error: "GATEWAY_ERROR" };
  }

  // In local development when no Flutterwave key is provided,
  // record gateway init success and confirm the in-app payment directly.
  await prisma.paymentLog.create({
    data: {
      reference,
      memberId: member.id,
      type: "GATEWAY_INIT_SUCCEEDED",
      status: "PENDING",
    },
  });

  const paidAt = new Date();

  await confirmPayment({
    reference,
    evidence: {
      gatewayTransactionId: `local_${reference}`,
      gatewayReference: `local_${reference}`,
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
