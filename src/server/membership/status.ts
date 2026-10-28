import "server-only";
import type { Tier } from "@prisma/client";
import type { MembershipStatus } from "@/types/member";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MembershipState {
  status: MembershipStatus;
  effectiveTier: Tier;
}

export function computeMembershipStatus(input: {
  tier: Tier;
  expiryDate: Date | null;
  cancelledAt: Date | null;
  graceDays: number;
  now?: Date;
}): MembershipState {
  if (input.cancelledAt) {
    return { status: "cancelled", effectiveTier: "BASIC" };
  }

  // No expiry date means no plan has ever been paid for. She is new, not
  // expired. Effective tier stays Basic until a plan is confirmed.
  if (!input.expiryDate) {
    return { status: "new", effectiveTier: "BASIC" };
  }

  const now = input.now ?? new Date();

  if (input.expiryDate.getTime() > now.getTime()) {
    return { status: "active", effectiveTier: input.tier };
  }

  const graceDays = Math.max(0, input.graceDays);
  const graceEnd = input.expiryDate.getTime() + graceDays * DAY_MS;

  if (now.getTime() <= graceEnd) {
    return { status: "grace", effectiveTier: input.tier };
  }

  return { status: "expired", effectiveTier: "BASIC" };
}
