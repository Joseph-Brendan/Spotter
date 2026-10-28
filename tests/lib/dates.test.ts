import { describe, expect, it } from "vitest";
import { formatDate, monthRangeInTimeZone } from "@/lib/dates";

describe("dates", () => {
  it("returns the current month range in the gym timezone", () => {
    const { start, end } = monthRangeInTimeZone(
      new Date("2026-10-26T12:00:00.000Z"),
      "Africa/Lagos"
    );

    expect(start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("formats a date for display", () => {
    expect(
      formatDate("2026-10-26T12:00:00.000Z", "Africa/Lagos")
    ).toContain("2026");
  });
});
