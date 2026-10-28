import "server-only";
import type { Tier } from "@prisma/client";
import { prisma } from "@/server/db";
import { getMembershipPlan } from "@/server/membership/plans";
import type { PaymentPurpose } from "@/types/payments";

export interface PaymentQuote {
  purpose: PaymentPurpose;
  tier: Tier;
  amountKobo: number;
}

export async function getMemberPaymentQuote(
  memberId: string,
  purpose: PaymentPurpose,
  tier?: Tier
): Promise<PaymentQuote | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      gymId: true,
      tier: true,
    },
  });

  if (!member) {
    throw new Error("Member record could not be read.");
  }

  const selectedTier = tier ?? member.tier;
  let amountKobo = 0;

  if (purpose === "RENEWAL") {
    const plan = await getMembershipPlan(member.gymId, selectedTier);
    amountKobo = plan?.priceKobo ?? 0;
  } else {
    const ledger = await prisma.ledgerEntry.aggregate({
      where: { memberId },
      _sum: { amountKobo: true },
    });
    amountKobo = ledger._sum.amountKobo ?? 0;
  }

  await prisma.privateAccessLog.create({
    data: {
      sessionMemberId: memberId,
      targetMemberId: memberId,
      functionName: "getMemberPaymentQuote",
    },
  });

  if (amountKobo <= 0) {
    return null;
  }

  return { purpose, tier: selectedTier, amountKobo };
}
