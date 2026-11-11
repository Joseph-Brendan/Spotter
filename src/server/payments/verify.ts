import "server-only";
import { env } from "@/lib/env";
import { prisma } from "@/server/db";
import { confirmPayment, type PaymentVerificationEvidence } from "./confirm";

const FLUTTERWAVE_API = "https://api.flutterwave.com/v3";

export type VerifySource = "webhook" | "return";

export type VerifyLookup =
  | { by: "id"; transactionId: string }
  | { by: "reference" };

export type VerifyOutcome =
  | "confirmed"
  | "failed"
  | "pending"
  | "not_configured"
  | "request_failed"
  | "request_threw"
  | "mismatch"
  | "confirm_error";

export interface VerifiableLog {
  reference: string;
  memberId: string | null;
  amountKobo: number | null;
  currency: string | null;
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

// Both confirmation paths, the webhook and the member's return from checkout,
// go through this function so the gateway checks can never drift apart.
// On the return path a missing or still pending transaction is normal while
// the member is paying, so it writes no log row for those outcomes.
export async function verifyAndConfirmPayment(input: {
  log: VerifiableLog;
  lookup: VerifyLookup;
  source: VerifySource;
  fallbackGatewayReference?: string | null;
}): Promise<VerifyOutcome> {
  const { log, lookup, source } = input;
  const recordInterim = source === "webhook";
  const lookupId = lookup.by === "id" ? lookup.transactionId : null;

  const secretKey = env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    if (recordInterim) {
      await prisma.paymentLog.create({
        data: {
          reference: log.reference,
          memberId: log.memberId,
          type: "VERIFY_FAILED",
          status: "PENDING",
          reason: "VERIFY_NOT_CONFIGURED",
          verificationError: "Gateway verification is not configured.",
        },
      });
    }
    return "not_configured";
  }

  const verifyUrl =
    lookup.by === "id"
      ? `${FLUTTERWAVE_API}/transactions/${encodeURIComponent(
          lookup.transactionId
        )}/verify`
      : `${FLUTTERWAVE_API}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(
          log.reference
        )}`;

  const receivedAt = new Date();
  let verifyBody: VerifyTransactionBody;

  try {
    const verifyResponse = await fetch(verifyUrl, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!verifyResponse.ok) {
      if (recordInterim) {
        await prisma.paymentLog.create({
          data: {
            reference: log.reference,
            memberId: log.memberId,
            type: "VERIFY_FAILED",
            status: "PENDING",
            reason: "VERIFY_REQUEST_FAILED",
            gatewayTransactionId: lookupId,
            verificationError: "Gateway verification request failed.",
          },
        });
      }
      return "request_failed";
    }

    verifyBody = (await verifyResponse.json()) as VerifyTransactionBody;
  } catch {
    if (recordInterim) {
      await prisma.paymentLog.create({
        data: {
          reference: log.reference,
          memberId: log.memberId,
          type: "VERIFY_FAILED",
          status: "PENDING",
          reason: "VERIFY_REQUEST_FAILED",
          gatewayTransactionId: lookupId,
          verificationError: "Gateway verification request failed.",
        },
      });
    }
    return "request_threw";
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
    await prisma.paymentLog.create({
      data: {
        reference: log.reference,
        memberId: log.memberId,
        type: "VERIFY_MISMATCH",
        status: "PENDING",
        reason: "DETAILS_MISMATCH",
        gatewayTransactionId: verified?.id
          ? String(verified.id)
          : lookupId,
        gatewayReference: verified?.flw_ref ? String(verified.flw_ref) : null,
        gatewayStatus:
          typeof verified?.status === "string" ? verified.status : undefined,
        reportedAmountKobo: Number.isFinite(verifiedAmountKobo)
          ? verifiedAmountKobo
          : undefined,
        reportedCurrency:
          typeof verified?.currency === "string" ? verified.currency : undefined,
        verificationError:
          "Gateway verification did not match the payment log.",
      },
    });
    return "mismatch";
  }

  const gatewayTransactionId = String(verified.id ?? lookupId);
  const gatewayReference =
    verified.flw_ref || input.fallbackGatewayReference || gatewayTransactionId;

  if (verified.status === "failed") {
    await prisma.paymentLog.create({
      data: {
        reference: log.reference,
        memberId: log.memberId,
        type: "GATEWAY_FAILED",
        status: "FAILED",
        gatewayTransactionId,
        gatewayReference,
        gatewayStatus: verified.status,
        reportedAmountKobo: verifiedAmountKobo,
        reportedCurrency: verified.currency,
        verificationError: "Gateway reported the transaction as failed.",
      },
    });
    return "failed";
  }

  if (verified.status !== "successful") {
    if (recordInterim) {
      await prisma.paymentLog.create({
        data: {
          reference: log.reference,
          memberId: log.memberId,
          type: "GATEWAY_PENDING",
          status: "PENDING",
          gatewayTransactionId,
          gatewayReference,
          gatewayStatus: verified.status,
          reportedAmountKobo: verifiedAmountKobo,
          reportedCurrency: verified.currency,
        },
      });
    }
    return "pending";
  }

  const evidence: PaymentVerificationEvidence = {
    gatewayTransactionId,
    gatewayReference,
    gatewayStatus: verified.status,
    verifiedAmountKobo,
    verifiedCurrency: verified.currency,
    webhookReceivedAt: receivedAt,
  };

  try {
    await confirmPayment({
      reference: log.reference,
      evidence,
      paidAt: receivedAt,
    });
  } catch (err) {
    // The webhook and the return check can race. If the other one won,
    // the unique payment reference rejects this attempt and the payment
    // is already confirmed.
    const confirmedElsewhere = await prisma.paymentLog.findFirst({
      where: { reference: log.reference, type: "CONFIRMED" },
    });

    if (confirmedElsewhere) {
      return "confirmed";
    }

    await prisma.paymentLog.create({
      data: {
        reference: log.reference,
        memberId: log.memberId,
        type: "VERIFY_FAILED",
        status: "PENDING",
        reason: "PLAN_SNAPSHOT_MISSING",
        verificationError:
          err instanceof Error ? err.message : "Confirmation failed.",
      },
    });
    return "confirm_error";
  }

  return "confirmed";
}
