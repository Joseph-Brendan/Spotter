import { describe, expect, it } from "vitest";
import {
  dateKeyToDbDate,
  gymLocalTime,
  isWithinOpeningHours,
} from "@/lib/gym-time";

describe("gymLocalTime", () => {
  it("uses the gym's calendar day, not the server's", () => {
    // 23:30 UTC is 00:30 the next day in Lagos (UTC+1).
    const result = gymLocalTime(
      new Date("2026-11-09T23:30:00.000Z"),
      "Africa/Lagos"
    );

    expect(result).toEqual({ dateKey: "2026-11-10", minutes: 30 });
  });

  it("reports minutes since local midnight", () => {
    const result = gymLocalTime(
      new Date("2026-11-09T18:15:00.000Z"),
      "Africa/Lagos"
    );

    expect(result).toEqual({ dateKey: "2026-11-09", minutes: 19 * 60 + 15 });
  });
});

describe("dateKeyToDbDate", () => {
  it("stores the day as UTC midnight", () => {
    expect(dateKeyToDbDate("2026-11-09").toISOString()).toBe(
      "2026-11-09T00:00:00.000Z"
    );
  });
});

describe("isWithinOpeningHours", () => {
  it("opens at the opening minute and closes at the closing minute", () => {
    expect(isWithinOpeningHours("06:00", "22:00", 5 * 60 + 59)).toBe(false);
    expect(isWithinOpeningHours("06:00", "22:00", 6 * 60)).toBe(true);
    expect(isWithinOpeningHours("06:00", "22:00", 21 * 60 + 59)).toBe(true);
    expect(isWithinOpeningHours("06:00", "22:00", 22 * 60)).toBe(false);
  });

  it("handles a gym that closes after midnight", () => {
    expect(isWithinOpeningHours("18:00", "02:00", 23 * 60)).toBe(true);
    expect(isWithinOpeningHours("18:00", "02:00", 60)).toBe(true);
    expect(isWithinOpeningHours("18:00", "02:00", 3 * 60)).toBe(false);
  });

  it("fails closed on an unreadable time", () => {
    expect(isWithinOpeningHours("6am", "22:00", 12 * 60)).toBe(false);
    expect(isWithinOpeningHours("06:00", "25:00", 12 * 60)).toBe(false);
    expect(isWithinOpeningHours("06:00", "06:00", 12 * 60)).toBe(false);
  });
});
