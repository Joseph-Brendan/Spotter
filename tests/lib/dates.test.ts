import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  monthRangeInTimeZone,
} from "@/lib/dates";

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

  it("formats a date and time for display", () => {
    const formatted = formatDateTime(
      "2026-10-26T12:00:00.000Z",
      "Africa/Lagos"
    );

    expect(formatted).toContain("2026");
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});
