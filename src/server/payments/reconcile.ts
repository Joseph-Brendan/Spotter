import "server-only";
import {
  getMemberLatestPayment,
  type MemberPaymentState,
} from "@/server/private/payment-status";
import { verifyAndConfirmPayment } from "./verify";

// Runs when the member is back from checkout. The member ID comes from the
// session only, and the gateway is asked about her own latest payment, so the
// browser supplies nothing that selects or confirms a payment.
export async function reconcileMemberPayment(
  memberId: string
): Promise<MemberPaymentState> {
  const latest = await getMemberLatestPayment(memberId);

  if (
    !latest.log ||
    latest.state === "none" ||
    latest.state === "confirmed" ||
    latest.state === "review"
  ) {
    return latest.state;
  }

  const outcome = await verifyAndConfirmPayment({
    log: latest.log,
    lookup: { by: "reference" },
    source: "return",
  });

  if (outcome === "confirmed") {
    return "confirmed";
  }

  if (outcome === "failed") {
    return "failed";
  }

  if (outcome === "mismatch") {
    return "review";
  }

  return "pending";
}
