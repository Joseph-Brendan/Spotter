import "server-only";
import { monthRangeInTimeZone } from "@/lib/dates";
import { prisma } from "@/server/db";
import { listMembershipPlans } from "@/server/membership/plans";
import { computeMembershipStatus } from "@/server/membership/status";
import type { MemberBillingSummary } from "@/types/member";

export async function getMemberBillingSummary(
  memberId: string
): Promise<MemberBillingSummary> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      gymId: true,
      tier: true,
      expiryDate: true,
      cancelledAt: true,
      gym: {
        select: {
          graceDays: true,
          timezone: true,
        },
      },
    },
  });

  if (!member) {
    throw new Error("Member record could not be read.");
  }

  const now = new Date();
  const { start, end } = monthRangeInTimeZone(now, member.gym.timezone);

  const [plans, ledger, daysTrainedThisMonth] = await Promise.all([
    listMembershipPlans(member.gymId),
    prisma.ledgerEntry.aggregate({
      where: { memberId },
      _sum: { amountKobo: true },
    }),
    prisma.checkIn.count({
      where: {
        memberId,
        date: { gte: start, lt: end },
      },
    }),
  ]);

  await prisma.privateAccessLog.create({
    data: {
      sessionMemberId: memberId,
      targetMemberId: memberId,
      functionName: "getMemberBillingSummary",
    },
  });

  const state = computeMembershipStatus({
    tier: member.tier,
    expiryDate: member.expiryDate,
    cancelledAt: member.cancelledAt,
    graceDays: member.gym.graceDays,
    now,
  });
  const plan = plans.find((record) => record.tier === member.tier) ?? null;

  return {
    status: state.status,
    storedTier: member.tier,
    effectiveTier: state.effectiveTier,
    expiryDate: member.expiryDate?.toISOString() ?? null,
    gymTimezone: member.gym.timezone,
    daysTrainedThisMonth,
    balanceKobo: ledger._sum.amountKobo ?? 0,
    fetchedAt: now.toISOString(),
    plan: plan
      ? {
          tier: plan.tier,
          priceKobo: plan.priceKobo,
          durationDays: plan.durationDays,
        }
      : null,
    availablePlans: plans.map((record) => ({
      tier: record.tier,
      priceKobo: record.priceKobo,
      durationDays: record.durationDays,
    })),
  };
}
