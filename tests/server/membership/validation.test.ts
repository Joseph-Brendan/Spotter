import { describe, expect, it } from "vitest";
import {
  createMemberSchema,
  createMembershipPlanSchema,
} from "@/server/membership/validation";

describe("membership management validation", () => {
  it("normalizes a valid member form", () => {
    const result = createMemberSchema.parse({
      name: "  Ada Okafor  ",
      memberNumber: "123456",
      phone: "  +234 800 000 0000  ",
      tier: "PREMIUM",
      expiryDate: "2027-02-28",
      openingBalanceKobo: "1500000",
    });

    expect(result).toEqual({
      name: "Ada Okafor",
      memberNumber: "123456",
      phone: "+234 800 000 0000",
      tier: "PREMIUM",
      expiryDate: "2027-02-28",
      openingBalanceKobo: 1_500_000,
    });
  });

  it("rejects invalid member numbers, dates and fractional balances", () => {
    expect(
      createMemberSchema.safeParse({
        name: "Ada Okafor",
        memberNumber: "12345",
        phone: "",
        tier: "BASIC",
        expiryDate: "2027-02-30",
        openingBalanceKobo: "2.5",
      }).success
    ).toBe(false);
  });

  it("requires non-negative whole-kobo prices and positive durations", () => {
    expect(
      createMembershipPlanSchema.safeParse({
        tier: "BASIC",
        priceKobo: "1500000",
        durationDays: "30",
      }).success
    ).toBe(true);

    expect(
      createMembershipPlanSchema.safeParse({
        tier: "BASIC",
        priceKobo: "-1",
        durationDays: "0",
      }).success
    ).toBe(false);
  });
});
