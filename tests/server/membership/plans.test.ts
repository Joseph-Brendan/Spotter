import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  getMembershipPlan,
  listMembershipPlans,
  upsertMembershipPlan,
} from "@/server/membership/plans";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("membership plans", () => {
  beforeEach(async () => {
    await prisma.membershipPlan.deleteMany();
    await prisma.member.deleteMany();
    await prisma.gym.deleteMany();
  });

  async function createGym() {
    return prisma.gym.create({
      data: {
        name: "Test Gym",
        timezone: "Africa/Lagos",
        openingTime: "06:00",
        closingTime: "22:00",
        graceDays: 3,
      },
    });
  }

  it("creates and updates a plan by tier", async () => {
    const gym = await createGym();

    expect(await listMembershipPlans(gym.id)).toEqual([]);

    await upsertMembershipPlan({
      gymId: gym.id,
      tier: "BASIC",
      priceKobo: 1_000_000,
      durationDays: 30,
    });
    await upsertMembershipPlan({
      gymId: gym.id,
      tier: "PREMIUM",
      priceKobo: 2_000_000,
      durationDays: 60,
    });
    await upsertMembershipPlan({
      gymId: gym.id,
      tier: "BASIC",
      priceKobo: 1_200_000,
      durationDays: 31,
    });

    const plans = await listMembershipPlans(gym.id);
    expect(plans).toEqual([
      { tier: "BASIC", priceKobo: 1_200_000, durationDays: 31 },
      { tier: "PREMIUM", priceKobo: 2_000_000, durationDays: 60 },
    ]);

    expect(await getMembershipPlan(gym.id, "BASIC")).toEqual({
      tier: "BASIC",
      priceKobo: 1_200_000,
      durationDays: 31,
    });
    expect(await getMembershipPlan(gym.id, "PREMIUM")).toEqual({
      tier: "PREMIUM",
      priceKobo: 2_000_000,
      durationDays: 60,
    });
  });
});
