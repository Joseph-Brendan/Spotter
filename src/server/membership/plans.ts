import "server-only";
import type { Tier } from "@prisma/client";
import { prisma } from "@/server/db";

export interface MembershipPlanRecord {
  tier: Tier;
  priceKobo: number;
  durationDays: number;
}

const TIER_ORDER: Record<Tier, number> = {
  BASIC: 1,
  PREMIUM: 2,
  DIAMOND: 3,
};

export async function listMembershipPlans(
  gymId: string
): Promise<MembershipPlanRecord[]> {
  const plans = await prisma.membershipPlan.findMany({
    where: { gymId },
    select: {
      tier: true,
      priceKobo: true,
      durationDays: true,
    },
  });

  return plans.sort(
    (a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99)
  );
}

export async function getMembershipPlan(
  gymId: string,
  tier: Tier
): Promise<MembershipPlanRecord | null> {
  return prisma.membershipPlan.findUnique({
    where: { gymId_tier: { gymId, tier } },
    select: {
      tier: true,
      priceKobo: true,
      durationDays: true,
    },
  });
}

export async function upsertMembershipPlan(input: {
  gymId: string;
  tier: Tier;
  priceKobo: number;
  durationDays: number;
}): Promise<void> {
  await prisma.membershipPlan.upsert({
    where: { gymId_tier: { gymId: input.gymId, tier: input.tier } },
    update: {
      priceKobo: input.priceKobo,
      durationDays: input.durationDays,
    },
    create: {
      gymId: input.gymId,
      tier: input.tier,
      priceKobo: input.priceKobo,
      durationDays: input.durationDays,
    },
  });
}
