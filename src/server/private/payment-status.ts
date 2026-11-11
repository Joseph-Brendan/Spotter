import "server-only";
import { prisma } from "@/server/db";

// Matches the abandonment window in rules/payments.md. A journey older than
// this is left to the nightly job and the webhook.
const RECENT_PAYMENT_MS = 24 * 60 * 60 * 1000;

export type MemberPaymentState =
  | "none"
  | "pending"
  | "confirmed"
  | "failed"
  | "review";

export interface MemberLatestPayment {
  state: MemberPaymentState;
  log: {
    reference: string;
    memberId: string | null;
    amountKobo: number | null;
    currency: string | null;
  } | null;
}

export async function getMemberLatestPayment(
  memberId: string
): Promise<MemberLatestPayment> {
  const since = new Date(Date.now() - RECENT_PAYMENT_MS);

  const initiated = await prisma.paymentLog.findFirst({
    where: {
      memberId,
      type: "INITIATED",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select: {
      reference: true,
      memberId: true,
      amountKobo: true,
      currency: true,
    },
  });

  let state: MemberPaymentState = "none";

  if (initiated) {
    const resolution = await prisma.paymentLog.findFirst({
      where: {
        memberId,
        reference: initiated.reference,
        type: { in: ["CONFIRMED", "GATEWAY_FAILED", "VERIFY_MISMATCH"] },
      },
      orderBy: { createdAt: "desc" },
      select: { type: true },
    });

    state =
      resolution?.type === "CONFIRMED"
        ? "confirmed"
        : resolution?.type === "GATEWAY_FAILED"
          ? "failed"
          : resolution?.type === "VERIFY_MISMATCH"
            ? "review"
            : "pending";
  }

  await prisma.privateAccessLog.create({
    data: {
      sessionMemberId: memberId,
      targetMemberId: memberId,
      functionName: "getMemberLatestPayment",
    },
  });

  return { state, log: initiated };
}
