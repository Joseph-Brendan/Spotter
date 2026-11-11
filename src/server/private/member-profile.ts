import "server-only";
import { monthRangeInTimeZone } from "@/lib/dates";
import { prisma } from "@/server/db";
import { computeMembershipStatus } from "@/server/membership/status";
import type { MemberTier } from "@/types/member";
import type { OwnerMemberProfile } from "@/types/staff";

const PAID_TIER: Record<"BASIC" | "PREMIUM" | "DIAMOND", MemberTier> = {
  BASIC: "BASIC",
  PREMIUM: "PREMIUM",
  DIAMOND: "DIAMOND",
};

export async function getOwnerMemberProfile(
  memberId: string,
  actor: { staffId: string; gymId: string; role: string }
): Promise<OwnerMemberProfile | null> {
  if (actor.role !== "OWNER") {
    return null;
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      gymId: true,
      memberNumber: true,
      name: true,
      email: true,
      phone: true,
      tier: true,
      expiryDate: true,
      cancelledAt: true,
      accountCreatedAt: true,
      createdAt: true,
      deletedAt: true,
      gym: {
        select: {
          graceDays: true,
          timezone: true,
        },
      },
    },
  });

  if (!member || member.gymId !== actor.gymId) {
    return null;
  }

  await prisma.staffMemberAccessLog.create({
    data: {
      staffId: actor.staffId,
      memberId,
      gymId: member.gymId,
      functionName: "getOwnerMemberProfile",
    },
  });

  if (member.deletedAt) {
    return null;
  }

  const now = new Date();
  const { start, end } = monthRangeInTimeZone(now, member.gym.timezone);

  const [lastPayment, checkInSummary, checkInsThisMonth] = await Promise.all([
      prisma.payment.findFirst({
        where: { memberId },
        orderBy: [{ paidAt: "desc" }, { id: "desc" }],
        select: {
          paidAt: true,
          amountKobo: true,
          // Read the confirmed attempt: only that record snapshots the plan
          // that was actually paid for. The initiated attempt can have none.
          attempt: {
            select: {
              reference: true,
              type: true,
              planTier: true,
              planDurationDays: true,
            },
          },
        },
      }),
      // Total and most recent check-in come from one aggregate; only the
      // this-month window needs its own query.
      prisma.checkIn.aggregate({
        where: { memberId },
        _count: { _all: true },
        _max: { occurredAt: true },
      }),
      prisma.checkIn.count({
        where: {
          memberId,
          date: { gte: start, lt: end },
        },
      }),
    ]);

  const state = computeMembershipStatus({
    tier: member.tier,
    expiryDate: member.expiryDate,
    cancelledAt: member.cancelledAt,
    graceDays: member.gym.graceDays,
    now,
  });

  // The plan shown must be one the member actually paid for. Read it only from
  // records written when that payment was made, never from the gym's current
  // price list. The attempt snapshot is preferred; the confirmed log for the
  // same reference is the fallback.
  let paidPlan: {
    tier: MemberTier;
    durationDays: number;
    amountKobo: number;
    paidAt: Date;
  } | null = null;

  if (lastPayment) {
    const attempt = lastPayment.attempt;
    let planTier = attempt?.planTier ?? null;
    let planDurationDays = attempt?.planDurationDays ?? null;

    if ((!planTier || !planDurationDays) && attempt?.reference) {
      const confirmedLog = await prisma.paymentLog.findFirst({
        where: { reference: attempt.reference, type: "CONFIRMED" },
        select: { planTier: true, planDurationDays: true },
      });

      if (confirmedLog?.planTier && confirmedLog.planDurationDays) {
        planTier = confirmedLog.planTier;
        planDurationDays = confirmedLog.planDurationDays;
      }
    }

    if (planTier && planDurationDays) {
      paidPlan = {
        tier: PAID_TIER[planTier],
        durationDays: planDurationDays,
        amountKobo: lastPayment.amountKobo,
        paidAt: lastPayment.paidAt,
      };
    }
  }

  return {
    memberNumber: member.memberNumber,
    name: member.name ?? "Member",
    email: member.email,
    phone: member.phone,
    tier: member.tier,
    status: state.status,
    expiryDate: member.expiryDate?.toISOString() ?? null,
    registeredAt: (member.accountCreatedAt ?? member.createdAt).toISOString(),
    checkInsTotal: checkInSummary._count._all,
    checkInsThisMonth,
    lastCheckInAt: checkInSummary._max.occurredAt?.toISOString() ?? null,
    gymTimezone: member.gym.timezone,
    lastPayment: paidPlan
      ? {
          tier: paidPlan.tier,
          amountKobo: paidPlan.amountKobo,
          durationDays: paidPlan.durationDays,
          paidAt: paidPlan.paidAt.toISOString(),
        }
      : null,
  };
}
