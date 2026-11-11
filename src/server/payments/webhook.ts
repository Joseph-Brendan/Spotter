import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { prisma } from "@/server/db";
import { verifyAndConfirmPayment, type VerifyOutcome } from "./verify";

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

export async function processPaymentWebhook(
  signatureHeader: string | null,
  body: WebhookPayload
): Promise<{ success: boolean; status: number }> {
  const secretHash = env.FLUTTERWAVE_WEBHOOK_HASH;

  if (!secretHash || !safeEqual(signatureHeader, secretHash)) {
    const rawTxRef = body.data?.tx_ref;
    const txRef = typeof rawTxRef === "string" ? rawTxRef.slice(0, 100) : null;

    await prisma.paymentLog.create({
      data: {
        reference: txRef ?? "unknown",
        type: "WEBHOOK_REJECTED",
        status: "PENDING",
        reason: !secretHash
          ? "SECRET_NOT_CONFIGURED"
          : !signatureHeader
          ? "MISSING_HASH"
          : "BAD_HASH",
      },
    });

    return { success: false, status: 401 };
  }

  if (body.event && body.event !== "charge.completed") {
    return { success: true, status: 200 };
  }

  const txRef = body.data?.tx_ref;
  if (!txRef || typeof txRef !== "string") {
    await prisma.paymentLog.create({
      data: {
        reference: "missing",
        type: "WEBHOOK_REJECTED",
        status: "PENDING",
        reason: "MISSING_TX_REF",
      },
    });
    return { success: false, status: 400 };
  }

  const initiatedLog = await prisma.paymentLog.findFirst({
    where: { reference: txRef, type: "INITIATED" },
  });

  if (!initiatedLog) {
    await prisma.paymentLog.create({
      data: {
        reference: txRef.slice(0, 100),
        type: "WEBHOOK_REJECTED",
        status: "PENDING",
        reason: "UNKNOWN_REFERENCE",
      },
    });
    return { success: false, status: 404 };
  }

  const alreadyConfirmed = await prisma.paymentLog.findFirst({
    where: { reference: txRef, type: "CONFIRMED" },
  });

  const existingPayment = await prisma.payment.findUnique({
    where: { reference: txRef },
  });

  if (alreadyConfirmed || existingPayment) {
    await prisma.paymentLog.create({
      data: {
        reference: txRef,
        memberId: initiatedLog.memberId,
        type: "WEBHOOK_RECEIVED",
        status: "SUCCESS",
        gatewayTransactionId: body.data?.id ? String(body.data.id) : null,
        gatewayReference: body.data?.flw_ref ? String(body.data.flw_ref) : null,
      },
    });
    return { success: true, status: 200 };
  }

  await prisma.paymentLog.create({
    data: {
      reference: txRef,
      memberId: initiatedLog.memberId,
      type: "WEBHOOK_RECEIVED",
      status: "PENDING",
      gatewayTransactionId: body.data?.id ? String(body.data.id) : null,
      gatewayReference: body.data?.flw_ref ? String(body.data.flw_ref) : null,
    },
  });

  const transactionId = body.data?.id;
  if (
    transactionId === undefined ||
    transactionId === null ||
    transactionId === ""
  ) {
    await prisma.paymentLog.create({
      data: {
        reference: txRef,
        memberId: initiatedLog.memberId,
        type: "VERIFY_FAILED",
        status: "PENDING",
        reason: "MISSING_TRANSACTION_ID",
        verificationError: "Webhook did not include a gateway transaction id.",
      },
    });
    return { success: false, status: 400 };
  }

  const outcome = await verifyAndConfirmPayment({
    log: initiatedLog,
    lookup: { by: "id", transactionId: String(transactionId) },
    source: "webhook",
    fallbackGatewayReference: body.data?.flw_ref
      ? String(body.data.flw_ref)
      : null,
  });

  return WEBHOOK_RESPONSE[outcome];
}

const WEBHOOK_RESPONSE: Record<
  VerifyOutcome,
  { success: boolean; status: number }
> = {
  confirmed: { success: true, status: 200 },
  failed: { success: true, status: 200 },
  pending: { success: true, status: 200 },
  not_configured: { success: false, status: 500 },
  request_failed: { success: false, status: 502 },
  request_threw: { success: false, status: 500 },
  mismatch: { success: false, status: 400 },
  confirm_error: { success: false, status: 500 },
};

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
