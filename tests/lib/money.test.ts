import { describe, expect, it } from "vitest";
import {
  formatKobo,
  koboToNairaInput,
  parseNairaToKobo,
} from "@/lib/money";

describe("money", () => {
  it("parses naira into whole kobo", () => {
    expect(parseNairaToKobo("15000")).toBe(1_500_000);
    expect(parseNairaToKobo("15,000.50")).toBe(1_500_050);
    expect(parseNairaToKobo("0.01")).toBe(1);
  });

  it("rejects invalid naira values", () => {
    expect(parseNairaToKobo("")).toBeNull();
    expect(parseNairaToKobo("12.345")).toBeNull();
    expect(parseNairaToKobo("-10")).toBeNull();
    expect(parseNairaToKobo("abc")).toBeNull();
  });

  it("formats kobo and returns input values", () => {
    expect(formatKobo(1_500_000)).toContain("15,000");
    expect(koboToNairaInput(1_500_000)).toBe("15000");
    expect(koboToNairaInput(1_500_050)).toBe("15000.50");
  });
});
