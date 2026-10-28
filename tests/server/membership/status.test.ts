import { describe, expect, it } from "vitest";
import { computeMembershipStatus } from "@/server/membership/status";

const now = new Date("2026-10-26T12:00:00.000Z");

describe("computeMembershipStatus", () => {
  it("keeps the stored tier while active", () => {
    expect(
      computeMembershipStatus({
        tier: "PREMIUM",
        expiryDate: new Date("2026-11-01T00:00:00.000Z"),
        cancelledAt: null,
        graceDays: 3,
        now,
      })
    ).toEqual({ status: "active", effectiveTier: "PREMIUM" });
  });

  it("keeps DIAMOND tier while active and during grace", () => {
    expect(
      computeMembershipStatus({
        tier: "DIAMOND",
        expiryDate: new Date("2026-11-01T00:00:00.000Z"),
        cancelledAt: null,
        graceDays: 3,
        now,
      })
    ).toEqual({ status: "active", effectiveTier: "DIAMOND" });

    expect(
      computeMembershipStatus({
        tier: "DIAMOND",
        expiryDate: new Date("2026-10-25T12:00:00.000Z"),
        cancelledAt: null,
        graceDays: 3,
        now,
      })
    ).toEqual({ status: "grace", effectiveTier: "DIAMOND" });
  });

  it("keeps the stored tier during grace", () => {
    expect(
      computeMembershipStatus({
        tier: "PREMIUM",
        expiryDate: new Date("2026-10-25T12:00:00.000Z"),
        cancelledAt: null,
        graceDays: 3,
        now,
      })
    ).toEqual({ status: "grace", effectiveTier: "PREMIUM" });
  });

  it("drops to Basic after grace", () => {
    expect(
      computeMembershipStatus({
        tier: "PREMIUM",
        expiryDate: new Date("2026-10-20T12:00:00.000Z"),
        cancelledAt: null,
        graceDays: 3,
        now,
      })
    ).toEqual({ status: "expired", effectiveTier: "BASIC" });
  });

  it("treats cancellation as Basic even before expiry", () => {
    expect(
      computeMembershipStatus({
        tier: "PREMIUM",
        expiryDate: new Date("2026-11-01T00:00:00.000Z"),
        cancelledAt: new Date("2026-10-20T00:00:00.000Z"),
        graceDays: 3,
        now,
      })
    ).toEqual({ status: "cancelled", effectiveTier: "BASIC" });
  });

  it("treats a missing expiry as a new member on Basic", () => {
    expect(
      computeMembershipStatus({
        tier: "PREMIUM",
        expiryDate: null,
        cancelledAt: null,
        graceDays: 3,
        now,
      })
    ).toEqual({ status: "new", effectiveTier: "BASIC" });
  });

  it("treats a cancelled member with no expiry as cancelled", () => {
    expect(
      computeMembershipStatus({
        tier: "BASIC",
        expiryDate: null,
        cancelledAt: new Date("2026-10-20T00:00:00.000Z"),
        graceDays: 3,
        now,
      })
    ).toEqual({ status: "cancelled", effectiveTier: "BASIC" });
  });
});
