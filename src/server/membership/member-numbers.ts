import "server-only";
import { randomInt } from "node:crypto";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { fuzzyScore } from "@/lib/fuzzy";
import type {
  StaffMemberNumberPagination,
  StaffMemberNumberReservation,
} from "@/types/staff";

const MEMBER_NUMBER_MIN = 100000;
const MEMBER_NUMBER_MAX = 1000000;
const RESERVATION_ATTEMPTS = 10;
export const MEMBER_NUMBER_RESERVATION_PAGE_SIZE = 5;

// Search reads at most this many rows. Members of the gym are capped at three
// tiers and numbers are never reused, so a typo-tolerant match over the newest
// few hundred reservations is enough to find what a front desk officer means.
const SEARCH_CANDIDATE_LIMIT = 500;
const SEARCH_PREFIX_LIMIT = 50;

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

export interface MemberNumberReservationList {
  timezone: string;
  reservations: StaffMemberNumberReservation[];
  pagination: StaffMemberNumberPagination;
}

export interface MemberNumberReservationListInput extends ReservationScope {
  page: number;
  search: string;
  includeEmail: boolean;
}

type ReservationRow = {
  memberNumber: string;
  email?: string | null;
  createdAt: Date;
  claimedAt: Date | null;
};

// The gym timezone never changes per gym, so one lookup serves every call in a
// request (the page reads it on each render and each search).
const getGymTimezone = cache(async (gymId: string): Promise<string | null> => {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { timezone: true },
  });

  return gym?.timezone ?? null;
});

function clampPage(value: number, totalPages: number): number {
  const requested = Number.isInteger(value) && value > 0 ? value : 1;

  return Math.min(requested, totalPages);
}

function toStaffMemberNumberReservation(
  reservation: ReservationRow,
  includeEmail: boolean
): StaffMemberNumberReservation {
  return {
    memberNumber: reservation.memberNumber,
    ...(includeEmail ? { email: reservation.email ?? null } : {}),
    createdAt: reservation.createdAt.toISOString(),
    claimedAt: reservation.claimedAt?.toISOString() ?? null,
  };
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

export async function listMemberNumberReservations(
  input: MemberNumberReservationListInput
): Promise<MemberNumberReservationList> {
  const where = {
    gymId: input.gymId,
    createdByStaffId: input.staffId,
  };
  const search = input.search.trim();
  const pageSize = MEMBER_NUMBER_RESERVATION_PAGE_SIZE;

  if (search) {
    const searchSelect = {
      memberNumber: true,
      createdAt: true,
      claimedAt: true,
      ...(input.includeEmail ? { email: true } : {}),
    } as const;

    // Two bounded reads instead of loading every reservation: an exact/prefix
    // pass so a precise query is never missed, then a capped fuzzy pass.
    const [timezone, prefixMatches, candidates] = await Promise.all([
      getGymTimezone(input.gymId),
      prisma.memberNumberReservation.findMany({
        where: {
          ...where,
          OR: [
            { memberNumber: { startsWith: search } },
            ...(input.includeEmail
              ? [{ email: { contains: search, mode: "insensitive" as const } }]
              : []),
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: SEARCH_PREFIX_LIMIT,
        select: searchSelect,
      }),
      prisma.memberNumberReservation.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: SEARCH_CANDIDATE_LIMIT,
        select: searchSelect,
      }),
    ]);

    const merged = new Map<string, ReservationRow>();

    for (const reservation of [...prefixMatches, ...candidates]) {
      merged.set(reservation.memberNumber, reservation);
    }

    const scored = [...merged.values()]
      .map((reservation) => ({
        reservation,
        score: Math.max(
          fuzzyScore(reservation.memberNumber, search),
          input.includeEmail && reservation.email
            ? fuzzyScore(reservation.email, search)
            : 0
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.reservation.createdAt.getTime() -
            left.reservation.createdAt.getTime()
      );

    const matches = scored.map((entry) => entry.reservation);

    const totalCount = matches.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = clampPage(input.page, totalPages);
    const pageReservations = matches.slice(
      (page - 1) * pageSize,
      page * pageSize
    );

    return {
      timezone: timezone ?? "UTC",
      reservations: pageReservations.map((reservation) =>
        toStaffMemberNumberReservation(reservation, input.includeEmail)
      ),
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
    };
  }

  const [timezone, totalCount] = await Promise.all([
    getGymTimezone(input.gymId),
    prisma.memberNumberReservation.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = clampPage(input.page, totalPages);

  const reservations = await prisma.memberNumberReservation.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      memberNumber: true,
      createdAt: true,
      claimedAt: true,
      ...(input.includeEmail ? { email: true } : {}),
    },
  });

  return {
    timezone: timezone ?? "UTC",
    reservations: reservations.map((reservation) =>
      toStaffMemberNumberReservation(reservation, input.includeEmail)
    ),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
  };
}

export async function findMemberIdByNumber(
  gymId: string,
  memberNumber: string
): Promise<string | null> {
  const member = await prisma.member.findUnique({
    where: { gymId_memberNumber: { gymId, memberNumber } },
    select: { id: true },
  });

  return member?.id ?? null;
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
