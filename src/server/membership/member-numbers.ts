import "server-only";
import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

const MEMBER_NUMBER_MIN = 100000;
const MEMBER_NUMBER_MAX = 1000000;
const RESERVATION_ATTEMPTS = 10;

export interface ReservationScope {
  gymId: string;
  staffId: string;
}

export interface ReserveMemberNumberInput extends ReservationScope {
  email: string;
}

export interface ReserveMemberNumberResult {
  success: boolean;
  memberNumber?: string;
}

export interface LatestReservation {
  memberNumber: string;
}

function generateCandidate(): string {
  return randomInt(MEMBER_NUMBER_MIN, MEMBER_NUMBER_MAX).toString();
}

export async function reserveMemberNumber(
  input: ReserveMemberNumberInput
): Promise<ReserveMemberNumberResult> {
  const email = input.email.trim().toLowerCase();

  for (let attempt = 0; attempt < RESERVATION_ATTEMPTS; attempt += 1) {
    const memberNumber = generateCandidate();

    try {
      await prisma.$transaction([
        prisma.member.create({
          data: {
            gymId: input.gymId,
            memberNumber,
          },
        }),
        prisma.memberNumberReservation.create({
          data: {
            gymId: input.gymId,
            memberNumber,
            email,
            createdByStaffId: input.staffId,
          },
        }),
      ]);

      return { success: true, memberNumber };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  return { success: false };
}

export async function getLatestReservation(
  input: ReservationScope
): Promise<LatestReservation | null> {
  return prisma.memberNumberReservation.findFirst({
    where: {
      gymId: input.gymId,
      createdByStaffId: input.staffId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      memberNumber: true,
    },
  });
}

export async function getReservationEmail(
  gymId: string,
  memberNumber: string
): Promise<string | null | undefined> {
  const reservation = await prisma.memberNumberReservation.findUnique({
    where: { gymId_memberNumber: { gymId, memberNumber } },
    select: { email: true },
  });

  return reservation?.email;
}
