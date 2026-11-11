import { describe, expect, it } from "vitest";
import { chatRequestSchema } from "@/server/ask/validation";

describe("chatRequestSchema", () => {
  it("trims the message", () => {
    const parsed = chatRequestSchema.safeParse({ message: "  hello  " });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.message).toBe("hello");
    }
  });

  it("rejects an empty or whitespace only message", () => {
    expect(chatRequestSchema.safeParse({ message: "" }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: "    " }).success).toBe(false);
    expect(chatRequestSchema.safeParse({}).success).toBe(false);
    expect(chatRequestSchema.safeParse(null).success).toBe(false);
  });

  it("accepts exactly five hundred characters and rejects one more", () => {
    expect(
      chatRequestSchema.safeParse({ message: "a".repeat(500) }).success
    ).toBe(true);
    expect(
      chatRequestSchema.safeParse({ message: "a".repeat(501) }).success
    ).toBe(false);
  });

  it("ignores unknown keys instead of failing on them", () => {
    // rules/privacy.md rule 2: a member ID in the body is ignored, and the
    // session is the only source of identity.
    const parsed = chatRequestSchema.safeParse({
      message: "What time do you open?",
      memberId: "someone-else",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ message: "What time do you open?" });
    }
  });
});
