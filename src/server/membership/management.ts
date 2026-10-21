import "server-only";
import { Prisma } from "@prisma/client";
import type { MembershipManagementData } from "@/types/staff";
import { prisma } from "@/server/db";
import type {
  CreateMemberInput,
  CreateMembershipPlanInput,
  UpdateMemberInput,
  UpdateMembershipPlanInput,
} from "./validation";

export const OPENING_BALANCE_REASON = "Opening balance";
export const OPENING_BALANCE_ADJUSTMENT_REASON =
  "Opening balance adjustment";

const OPENING_BALANCE_REASONS = [
  OPENING_BALANCE_REASON,
  OPENING_BALANCE_ADJUSTMENT_REASON,
];

export class MembershipManagementError extends Error {
  constructor(
    readonly code:
      | "MEMBER_NUMBER_TAKEN"
      | "MEMBER_NOT_FOUND"
      | "PLAN_TIER_TAKEN"
      | "PLAN_NOT_FOUND"
  ) {
    super(code);
    this.name = "MembershipManagementError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getMembershipManagementData(
  gymId: string
): Promise<MembershipManagementData> {
  const [members, plans] = await prisma.$transaction([
    prisma.member.findMany({
      where: { gymId },
      orderBy: [{ name: "asc" }, { memberNumber: "asc" }],
      select: {
        id: true,
        name: true,
        memberNumber: true,
        phone: true,
        tier: true,
        expiryDate: true,
        accountCreatedAt: true,
        ledgerEntries: {
          where: { reason: { in: OPENING_BALANCE_REASONS } },
          select: { amountKobo: true },
        },
      },
    }),
    prisma.membershipPlan.findMany({
      where: { gymId },
      orderBy: { tier: "asc" },
      select: {
        id: true,
        tier: true,
        priceKobo: true,
        durationDays: true,
      },
    }),
  ]);

  return {
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      memberNumber: member.memberNumber,
      phone: member.phone ?? "",
      tier: member.tier,
      expiryDate: member.expiryDate.toISOString().slice(0, 10),
      openingBalanceKobo: member.ledgerEntries.reduce(
        (total, entry) => total + entry.amountKobo,
        0
      ),
      hasAccount: member.accountCreatedAt !== null,
    })),
    plans,
  };
}

export async function createMemberRecord(
  gymId: string,
  staffId: string,
  input: CreateMemberInput
): Promise<void> {
  try {
    await prisma.$transaction(async (transaction) => {
      const member = await transaction.member.create({
        data: {
          gymId,
          name: input.name,
          memberNumber: input.memberNumber,
          phone: input.phone,
          tier: input.tier,
          expiryDate: dateFromInput(input.expiryDate),
        },
        select: { id: true },
      });

      await transaction.ledgerEntry.create({
        data: {
          memberId: member.id,
          amountKobo: input.openingBalanceKobo,
          reason: OPENING_BALANCE_REASON,
          occurredAt: new Date(),
          recordedByStaffId: staffId,
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new MembershipManagementError("MEMBER_NUMBER_TAKEN");
    }

    throw error;
  }
}

export async function updateMemberRecord(
  gymId: string,
  staffId: string,
  input: UpdateMemberInput
): Promise<void> {
  try {
    await prisma.$transaction(async (transaction) => {
      const member = await transaction.member.findFirst({
        where: { id: input.id, gymId },
        select: {
          id: true,
          ledgerEntries: {
            where: { reason: { in: OPENING_BALANCE_REASONS } },
            select: { amountKobo: true },
          },
        },
      });

      if (!member) {
        throw new MembershipManagementError("MEMBER_NOT_FOUND");
      }

      await transaction.member.update({
        where: { id: member.id },
        data: {
          name: input.name,
          memberNumber: input.memberNumber,
          phone: input.phone,
          tier: input.tier,
          expiryDate: dateFromInput(input.expiryDate),
        },
      });

      const currentOpeningBalance = member.ledgerEntries.reduce(
        (total, entry) => total + entry.amountKobo,
        0
      );
      const adjustment = input.openingBalanceKobo - currentOpeningBalance;

      if (adjustment !== 0) {
        await transaction.ledgerEntry.create({
          data: {
            memberId: member.id,
            amountKobo: adjustment,
            reason: OPENING_BALANCE_ADJUSTMENT_REASON,
            occurredAt: new Date(),
            recordedByStaffId: staffId,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof MembershipManagementError) {
      throw error;
    }

    if (isUniqueConstraintError(error)) {
      throw new MembershipManagementError("MEMBER_NUMBER_TAKEN");
    }

    throw error;
  }
}

export async function createMembershipPlan(
  gymId: string,
  input: CreateMembershipPlanInput
): Promise<void> {
  try {
    await prisma.membershipPlan.create({
      data: { gymId, ...input },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new MembershipManagementError("PLAN_TIER_TAKEN");
    }

    throw error;
  }
}

export async function updateMembershipPlan(
  gymId: string,
  input: UpdateMembershipPlanInput
): Promise<void> {
  const existing = await prisma.membershipPlan.findFirst({
    where: { id: input.id, gymId },
    select: { id: true },
  });

  if (!existing) {
    throw new MembershipManagementError("PLAN_NOT_FOUND");
  }

  try {
    await prisma.membershipPlan.update({
      where: { id: existing.id },
      data: {
        tier: input.tier,
        priceKobo: input.priceKobo,
        durationDays: input.durationDays,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new MembershipManagementError("PLAN_TIER_TAKEN");
    }

    throw error;
  }
}
