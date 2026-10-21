import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  createMemberRecord,
  createMembershipPlan,
  getMembershipManagementData,
  OPENING_BALANCE_ADJUSTMENT_REASON,
  OPENING_BALANCE_REASON,
  updateMemberRecord,
} from "@/server/membership/management";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("membership management", () => {
  beforeEach(async () => {
    await prisma.ledgerEntry.deleteMany();
    await prisma.memberSession.deleteMany();
    await prisma.memberNumberReservation.deleteMany();
    await prisma.staffSession.deleteMany();
    await prisma.membershipPlan.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.member.deleteMany();
    await prisma.gym.deleteMany();
  });

  async function createGymAndOwner() {
    const gym = await prisma.gym.create({
      data: {
        name: "Test Gym",
        timezone: "Africa/Lagos",
        openingTime: "06:00",
        closingTime: "22:00",
        graceDays: 7,
      },
    });
    const owner = await prisma.staff.create({
      data: {
        gym: { connect: { id: gym.id } },
        name: "Gym Owner",
        email: "owner@example.com",
        passwordHash: "not-used-by-this-test",
        role: { connect: { key: "OWNER" } },
      },
    });

    return { gym, owner };
  }

  it("creates a member and stores the opening balance as a ledger entry", async () => {
    const { gym, owner } = await createGymAndOwner();

    await createMemberRecord(gym.id, owner.id, {
      name: "Ada Okafor",
      memberNumber: "123456",
      phone: "+2348000000000",
      tier: "PREMIUM",
      expiryDate: "2027-01-31",
      openingBalanceKobo: 1_500_000,
    });

    const member = await prisma.member.findUniqueOrThrow({
      where: {
        gymId_memberNumber: { gymId: gym.id, memberNumber: "123456" },
      },
      include: { ledgerEntries: true },
    });

    expect(member.ledgerEntries).toHaveLength(1);
    expect(member.ledgerEntries[0]).toMatchObject({
      amountKobo: 1_500_000,
      reason: OPENING_BALANCE_REASON,
      recordedByStaffId: owner.id,
    });
  });

  it("edits opening balance with an append-only adjustment", async () => {
    const { gym, owner } = await createGymAndOwner();
    await createMemberRecord(gym.id, owner.id, {
      name: "Ada Okafor",
      memberNumber: "123456",
      phone: null,
      tier: "BASIC",
      expiryDate: "2027-01-31",
      openingBalanceKobo: 1_500_000,
    });
    const member = await prisma.member.findUniqueOrThrow({
      where: {
        gymId_memberNumber: { gymId: gym.id, memberNumber: "123456" },
      },
    });

    await updateMemberRecord(gym.id, owner.id, {
      id: member.id,
      name: "Ada N. Okafor",
      memberNumber: "123456",
      phone: null,
      tier: "PREMIUM",
      expiryDate: "2027-02-28",
      openingBalanceKobo: 1_200_000,
    });

    const entries = await prisma.ledgerEntry.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: "asc" },
    });
    expect(entries.map(({ amountKobo, reason }) => ({ amountKobo, reason }))).toEqual([
      { amountKobo: 1_500_000, reason: OPENING_BALANCE_REASON },
      {
        amountKobo: -300_000,
        reason: OPENING_BALANCE_ADJUSTMENT_REASON,
      },
    ]);

    const data = await getMembershipManagementData(gym.id);
    expect(data.members[0]).toMatchObject({
      name: "Ada N. Okafor",
      tier: "PREMIUM",
      openingBalanceKobo: 1_200_000,
      hasAccount: false,
    });
  });

  it("enforces one member number and one plan tier per gym", async () => {
    const { gym, owner } = await createGymAndOwner();
    const memberInput = {
      name: "Ada Okafor",
      memberNumber: "123456",
      phone: null,
      tier: "BASIC" as const,
      expiryDate: "2027-01-31",
      openingBalanceKobo: 0,
    };

    await createMemberRecord(gym.id, owner.id, memberInput);
    await expect(
      createMemberRecord(gym.id, owner.id, {
        ...memberInput,
        name: "Another Member",
      })
    ).rejects.toMatchObject({
      code: "MEMBER_NUMBER_TAKEN",
    });

    await createMembershipPlan(gym.id, {
      tier: "BASIC",
      priceKobo: 1_500_000,
      durationDays: 30,
    });
    await expect(
      createMembershipPlan(gym.id, {
        tier: "BASIC",
        priceKobo: 2_000_000,
        durationDays: 31,
      })
    ).rejects.toMatchObject({
      code: "PLAN_TIER_TAKEN",
    });
  });
});
