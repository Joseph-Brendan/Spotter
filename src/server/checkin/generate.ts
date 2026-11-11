import "server-only";
import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { dateKeyToDbDate, gymLocalTime, isWithinOpeningHours } from "@/lib/gym-time";
import { prisma } from "@/server/db";
import { computeMembershipStatus } from "@/server/membership/status";

export const CHECKIN_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_COLLISION_RETRIES = 5;

export type GenerateCheckInResult =
  | {
      status: "created" | "existing";
      code: string;
      createdAt: Date;
      expiresAt: Date;
      gymTimezone: string;
    }
  | { status: "alreadyCheckedIn" }
  | { status: "gymClosed" }
  | { status: "needsPlan" };

function randomDigits(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// Eligibility is checked here, at generation, never at consumption.
export async function generateCheckInCode(
  memberId: string
): Promise<GenerateCheckInResult> {
  const now = new Date();

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      tier: true,
      expiryDate: true,
      cancelledAt: true,
      gym: {
        select: {
          timezone: true,
          openingTime: true,
          closingTime: true,
          graceDays: true,
        },
      },
    },
  });

  if (!member) {
    throw new Error("Member record could not be read.");
  }

  const { dateKey, minutes } = gymLocalTime(now, member.gym.timezone);

  const [todaysCheckIn, activeCode] = await Promise.all([
    prisma.checkIn.findUnique({
      where: { memberId_date: { memberId, date: dateKeyToDbDate(dateKey) } },
      select: { id: true },
    }),
    prisma.checkInCode.findFirst({
      where: { memberId, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { code: true, createdAt: true, expiresAt: true },
    }),
  ]);

  await prisma.privateAccessLog.create({
    data: {
      sessionMemberId: memberId,
      targetMemberId: memberId,
      functionName: "generateCheckInCode",
    },
  });

  const { status } = computeMembershipStatus({
    tier: member.tier,
    expiryDate: member.expiryDate,
    cancelledAt: member.cancelledAt,
    graceDays: member.gym.graceDays,
    now,
  });

  if (status !== "active" && status !== "grace") {
    return { status: "needsPlan" };
  }

  if (todaysCheckIn) {
    return { status: "alreadyCheckedIn" };
  }

  // A second tap while a code is still live returns that code. No new code,
  // no second email.
  if (activeCode) {
    return {
      status: "existing",
      code: activeCode.code,
      createdAt: activeCode.createdAt,
      expiresAt: activeCode.expiresAt,
      gymTimezone: member.gym.timezone,
    };
  }

  if (
    !isWithinOpeningHours(
      member.gym.openingTime,
      member.gym.closingTime,
      minutes
    )
  ) {
    return { status: "gymClosed" };
  }

  // The partial unique index on active digits decides collisions. On a
  // collision, draw new digits.
  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
    try {
      const created = await prisma.checkInCode.create({
        data: {
          memberId,
          code: randomDigits(),
          createdAt: now,
          expiresAt: new Date(now.getTime() + CHECKIN_CODE_TTL_MS),
        },
        select: { code: true, createdAt: true, expiresAt: true },
      });

      return {
        status: "created",
        code: created.code,
        createdAt: created.createdAt,
        expiresAt: created.expiresAt,
        gymTimezone: member.gym.timezone,
      };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  throw new Error("Could not generate a unique check in code.");
}
