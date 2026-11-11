import "server-only";
import { Prisma } from "@prisma/client";
import { dateKeyToDbDate, gymLocalTime } from "@/lib/gym-time";
import { prisma } from "@/server/db";

// The only place a check in code is consumed and the only place a code sourced
// attendance record is written. The simulated keypad and a future real keypad
// both call this one function with the digits they received.
//
// The lookup is by digits, not member ID (rules/privacy.md, first exception).
// The result carries no member data and is never shown to anyone.

export type VerifyCheckInResult =
  | { status: "checkedIn" }
  | { status: "alreadyCheckedIn" }
  | { status: "refused" };

const DIGITS = /^\d{6}$/;

export async function verifyCheckInCode(
  digits: string,
  consumedBy: string
): Promise<VerifyCheckInResult> {
  if (!DIGITS.test(digits)) {
    return { status: "refused" };
  }

  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const active = await tx.checkInCode.findFirst({
        where: { code: digits, consumedAt: null, expiresAt: { gt: now } },
        select: {
          id: true,
          memberId: true,
          createdAt: true,
          member: { select: { gym: { select: { timezone: true } } } },
        },
      });

      if (!active) {
        // A keypad retry of a code it already consumed returns the same
        // result and writes nothing.
        const consumed = await tx.checkInCode.findFirst({
          where: {
            code: digits,
            consumedAt: { not: null },
            expiresAt: { gt: now },
          },
          select: { id: true },
        });

        return consumed ? { status: "checkedIn" } : { status: "refused" };
      }

      const claimed = await tx.checkInCode.updateMany({
        where: { id: active.id, consumedAt: null },
        data: { consumedAt: now, consumedBy },
      });

      if (claimed.count === 0) {
        return { status: "checkedIn" };
      }

      // The visit counts on the gym day the code was generated, the same day
      // eligibility was checked for.
      const { dateKey } = gymLocalTime(
        active.createdAt,
        active.member.gym.timezone
      );

      await tx.checkIn.create({
        data: {
          memberId: active.memberId,
          date: dateKeyToDbDate(dateKey),
          occurredAt: now,
          source: "CODE",
          checkInCodeId: active.id,
        },
      });

      return { status: "checkedIn" };
    });
  } catch (error) {
    // She already has attendance for that day, for example a manual check in
    // recorded after she generated the code. The transaction rolls back, so
    // the code stays unconsumed and nothing is written.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { status: "alreadyCheckedIn" };
    }

    throw error;
  }
}
