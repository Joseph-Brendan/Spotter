import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { prisma } from "@/server/db";
import { confirmPayment, type PaymentVerificationEvidence } from "./confirm";

export interface WebhookPayload {
  event?: string;
  data?: {
    id?: number | string;
    tx_ref?: string;
    flw_ref?: string;
    amount?: number | string;
    currency?: string;
    status?: string;
  };
}

interface VerifyTransactionBody {
  status?: string;
  data?: {
    id?: number | string;
    tx_ref?: string;
    flw_ref?: string;
    amount?: number | string;
    currency?: string;
    status?: string;
  } | null;
}

export async function processPaymentWebhook(
  signatureHeader: string | null,
  body: WebhookPayload
): Promise<{ success: boolean; status: number }> {
  const secretHash = env.FLUTTERWAVE_WEBHOOK_HASH;

  if (!secretHash || !safeEqual(signatureHeader, secretHash)) {
    return { success: false, status: 401 };
  }

  if (body.event && body.event !== "charge.completed") {
    return { success: true, status: 200 };
  }

  const txRef = body.data?.tx_ref;
  if (!txRef) {
    return { success: false, status: 400 };
  }

  const log = await prisma.paymentLog.findUnique({
    where: { reference: txRef },
  });

  if (!log) {
    return { success: false, status: 404 };
  }

  if (log.status === "SUCCESS") {
    return { success: true, status: 200 };
  }

  const transactionId = body.data?.id;
  if (
    transactionId === undefined ||
    transactionId === null ||
    transactionId === ""
  ) {
    await recordVerificationError(
      log.id,
      "Webhook did not include a gateway transaction id."
    );
    return { success: false, status: 400 };
  }

  const secretKey = env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    await recordVerificationError(
      log.id,
      "Gateway verification is not configured."
    );
    return { success: false, status: 500 };
  }

  const receivedAt = new Date();
  let verifyBody: VerifyTransactionBody;

  try {
    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(
        String(transactionId)
      )}/verify`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    if (!verifyResponse.ok) {
      await recordVerificationError(
        log.id,
        "Gateway verification request failed."
      );
      return { success: false, status: 502 };
    }

    verifyBody = (await verifyResponse.json()) as VerifyTransactionBody;
  } catch {
    await recordVerificationError(
      log.id,
      "Gateway verification request failed."
    );
    return { success: false, status: 500 };
  }

  const verified = verifyBody.data;
  const verifiedAmountKobo = Math.round(Number(verified?.amount) * 100);

  if (
    verifyBody.status !== "success" ||
    !verified ||
    typeof verified.status !== "string" ||
    verified.tx_ref !== log.reference ||
    typeof verified.currency !== "string" ||
    verified.currency !== log.currency ||
    !Number.isFinite(verifiedAmountKobo) ||
    verifiedAmountKobo !== log.amountKobo
  ) {
    await recordVerificationError(
      log.id,
      "Gateway verification did not match the payment log."
    );
    return { success: false, status: 400 };
  }

  const gatewayTransactionId = String(verified.id ?? transactionId);
  const gatewayReference =
    verified.flw_ref || body.data?.flw_ref || String(transactionId);

  if (verified.status === "failed") {
    await recordFailedPayment(
      log.id,
      {
        gatewayTransactionId,
        gatewayReference,
        gatewayStatus: verified.status,
        verifiedAmountKobo,
        verifiedCurrency: verified.currency,
      },
      receivedAt
    );

    return { success: true, status: 200 };
  }

  if (verified.status !== "successful") {
    await recordGatewayStatus(
      log.id,
      {
        gatewayTransactionId,
        gatewayReference,
        gatewayStatus: verified.status,
      },
      receivedAt
    );

    return { success: true, status: 200 };
  }

  const evidence: PaymentVerificationEvidence = {
    gatewayTransactionId,
    gatewayReference,
    gatewayStatus: verified.status,
    verifiedAmountKobo,
    verifiedCurrency: verified.currency,
    webhookReceivedAt: receivedAt,
  };

  await confirmPayment({
    paymentLogId: log.id,
    evidence,
    paidAt: receivedAt,
  });

  return { success: true, status: 200 };
}

async function recordVerificationError(
  paymentLogId: string,
  reason: string
): Promise<void> {
  await prisma.paymentLog.update({
    where: { id: paymentLogId },
    data: {
      webhookReceivedAt: new Date(),
      verificationError: reason,
    },
  });
}

async function recordGatewayStatus(
  paymentLogId: string,
  status: {
    gatewayTransactionId: string;
    gatewayReference: string;
    gatewayStatus: string;
  },
  receivedAt: Date
): Promise<void> {
  await prisma.paymentLog.updateMany({
    where: { id: paymentLogId, status: "PENDING" },
    data: {
      ...status,
      webhookReceivedAt: receivedAt,
      verificationError: null,
    },
  });
}

async function recordFailedPayment(
  paymentLogId: string,
  failure: {
    gatewayTransactionId: string;
    gatewayReference: string;
    gatewayStatus: string;
    verifiedAmountKobo: number;
    verifiedCurrency: string;
  },
  receivedAt: Date
): Promise<void> {
  await prisma.paymentLog.updateMany({
    where: { id: paymentLogId, status: { not: "SUCCESS" } },
    data: {
      ...failure,
      status: "FAILED",
      webhookReceivedAt: receivedAt,
      verifiedAt: receivedAt,
      verificationError: null,
      failureReason: "Gateway reported the transaction as failed.",
      resolvedAt: receivedAt,
    },
  });
}

function safeEqual(left: string | null, right: string): boolean {
  if (!left) {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
