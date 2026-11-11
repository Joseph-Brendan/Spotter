import { beforeEach, describe, expect, it } from "vitest";
import { monthRangeInTimeZone } from "@/lib/dates";
import { prisma } from "@/server/db";
import { getOwnerMemberProfile } from "@/server/private/member-profile";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!hasTestDatabase)("owner member profile", () => {
  beforeEach(async () => {
    await prisma.ledgerEntry.deleteMany();
    await prisma.membershipChange.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.paymentLog.deleteMany();
    await prisma.staffMemberAccessLog.deleteMany();
    await prisma.checkIn.deleteMany();
    await prisma.checkInCode.deleteMany();
    await prisma.memberSession.deleteMany();
    await prisma.memberNumberReservation.deleteMany();
    await prisma.membershipPlan.deleteMany();
    await prisma.staffSession.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.member.deleteMany();
    await prisma.gym.deleteMany();
  });

  it("reports no paid plan for a member who has never paid, even when a plan exists", async () => {
    const gym = await prisma.gym.create({
      data: {
        name: "Test Gym",
        timezone: "Africa/Lagos",
        openingTime: "06:00",
        closingTime: "22:00",
        graceDays: 7,
      },
    });

    const staff = await prisma.staff.create({
      data: {
        gym: { connect: { id: gym.id } },
        name: "Owner",
        email: "owner@example.com",
        passwordHash: "not-used-by-this-test",
        role: { connect: { key: "OWNER" } },
      },
    });

    await prisma.membershipPlan.create({
      data: {
        gymId: gym.id,
        tier: "BASIC",
        priceKobo: 3000000,
        durationDays: 30,
      },
    });

    const registeredAt = new Date("2026-11-02T19:29:41.907Z");
    const expiryDate = new Date(Date.now() + 30 * DAY_MS);

    const member = await prisma.member.create({
      data: {
        gymId: gym.id,
        name: "Isaac Aina",
        memberNumber: "704714",
        email: "get2aina@outlook.com",
        phone: "+2348000000000",
        tier: "BASIC",
        expiryDate,
        accountCreatedAt: registeredAt,
      },
    });

    const { start } = monthRangeInTimeZone(new Date(), "Africa/Lagos");

    await prisma.checkIn.createMany({
      data: [
        { memberId: member.id, date: start, source: "MANUAL" },
        {
          memberId: member.id,
          date: new Date(start.getTime() + DAY_MS),
          source: "CODE",
        },
      ],
    });

    const profile = await getOwnerMemberProfile(member.id, {
      staffId: staff.id,
      gymId: gym.id,
      role: "OWNER",
    });

    expect(profile).not.toBeNull();
    expect(profile?.name).toBe("Isaac Aina");
    expect(profile?.tier).toBe("BASIC");
    expect(profile?.status).toBe("active");
    expect(profile?.checkInsTotal).toBe(2);
    expect(profile?.checkInsThisMonth).toBe(2);
    expect(profile?.lastPayment).toBeNull();
    expect(profile?.registeredAt).toBe(registeredAt.toISOString());

    const audit = await prisma.staffMemberAccessLog.findFirst({
      where: { staffId: staff.id, memberId: member.id },
    });

    expect(audit?.functionName).toBe("getOwnerMemberProfile");
    expect(audit?.gymId).toBe(gym.id);
  });

  it("reports the plan from the member's latest payment, not the current catalog price", async () => {
    const gym = await prisma.gym.create({
      data: {
        name: "Test Gym",
        timezone: "Africa/Lagos",
        openingTime: "06:00",
        closingTime: "22:00",
        graceDays: 7,
      },
    });

    const staff = await prisma.staff.create({
      data: {
        gym: { connect: { id: gym.id } },
        name: "Owner",
        email: "owner@example.com",
        passwordHash: "not-used-by-this-test",
        role: { connect: { key: "OWNER" } },
      },
    });

    // The catalog now says Premium costs 6,000,000. The member paid 5,000,000.
    await prisma.membershipPlan.create({
      data: {
        gymId: gym.id,
        tier: "PREMIUM",
        priceKobo: 6_000_000,
        durationDays: 30,
      },
    });

    const paidAt = new Date("2026-10-28T19:38:25.073Z");

    const member = await prisma.member.create({
      data: {
        gymId: gym.id,
        name: "Biodun Michael",
        memberNumber: "724633",
        tier: "PREMIUM",
        expiryDate: new Date("2026-12-27T19:29:51.177Z"),
      },
    });

    const log = await prisma.paymentLog.create({
      data: {
        memberId: member.id,
        reference: "profile-paid-reference",
        type: "INITIATED",
        purpose: "RENEWAL",
        status: "SUCCESS",
        amountKobo: 5_000_000,
        planTier: "PREMIUM",
        planDurationDays: 30,
      },
    });

    await prisma.payment.create({
      data: {
        memberId: member.id,
        attemptId: log.id,
        reference: "profile-paid-reference",
        amountKobo: 5_000_000,
        purpose: "RENEWAL",
        channel: "IN_APP",
        paidAt,
      },
    });

    const profile = await getOwnerMemberProfile(member.id, {
      staffId: staff.id,
      gymId: gym.id,
      role: "OWNER",
    });

    expect(profile?.lastPayment).toEqual({
      tier: "PREMIUM",
      amountKobo: 5_000_000,
      durationDays: 30,
      paidAt: paidAt.toISOString(),
    });
  });
});
