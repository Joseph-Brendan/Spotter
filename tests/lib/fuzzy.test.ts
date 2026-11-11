import { describe, expect, it } from "vitest";
import { fuzzyScore } from "@/lib/fuzzy";

describe("fuzzyScore", () => {
  it("matches exact and partial values", () => {
    expect(fuzzyScore("100234", "100234")).toBe(100);
    expect(fuzzyScore("100234", "1002")).toBeGreaterThan(0);
    expect(fuzzyScore("member@example.com", "example")).toBeGreaterThan(0);
  });

  it("tolerates a typo in an email token", () => {
    expect(fuzzyScore("joseph@example.com", "josph")).toBeGreaterThan(0);
  });

  it("matches a subsequence", () => {
    expect(fuzzyScore("joseph@example.com", "jse")).toBeGreaterThan(0);
  });

  it("returns zero when nothing matches", () => {
    expect(fuzzyScore("100234", "zzzzz")).toBe(0);
    expect(fuzzyScore("joseph@example.com", "qqqqq")).toBe(0);
  });
});
