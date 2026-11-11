import { describe, expect, it } from "vitest";
import {
  CHAT_RATE_LIMIT,
  CHAT_RATE_WINDOW_MS,
  takeModelAllowance,
} from "@/server/ask/rate-limit";

describe("takeModelAllowance", () => {
  it("allows exactly the limit inside one window", () => {
    const member = "member-limit";
    const now = 1_000_000;

    for (let attempt = 1; attempt <= CHAT_RATE_LIMIT; attempt += 1) {
      expect(takeModelAllowance(member, now).allowed).toBe(true);
    }
  });

  it("blocks the next attempt and says how long to wait", () => {
    const member = "member-blocked";
    const now = 2_000_000;

    for (let attempt = 1; attempt <= CHAT_RATE_LIMIT; attempt += 1) {
      takeModelAllowance(member, now);
    }

    const blocked = takeModelAllowance(member, now);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(
      CHAT_RATE_WINDOW_MS / 1000
    );
  });

  it("does not extend the window when a blocked attempt repeats", () => {
    const member = "member-no-extension";
    const now = 3_000_000;

    for (let attempt = 1; attempt <= CHAT_RATE_LIMIT; attempt += 1) {
      takeModelAllowance(member, now);
    }

    const first = takeModelAllowance(member, now + 10_000);
    const second = takeModelAllowance(member, now + 50_000);

    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSeconds).toBeLessThan(
      first.retryAfterSeconds
    );
  });

  it("lets the member back in when the window ends", () => {
    const member = "member-reset";
    const now = 4_000_000;

    for (let attempt = 1; attempt <= CHAT_RATE_LIMIT; attempt += 1) {
      takeModelAllowance(member, now);
    }

    expect(takeModelAllowance(member, now).allowed).toBe(false);
    expect(
      takeModelAllowance(member, now + CHAT_RATE_WINDOW_MS).allowed
    ).toBe(true);
  });

  it("keeps one member's usage out of another's", () => {
    const now = 5_000_000;

    for (let attempt = 1; attempt <= CHAT_RATE_LIMIT; attempt += 1) {
      takeModelAllowance("member-a", now);
    }

    expect(takeModelAllowance("member-a", now).allowed).toBe(false);
    expect(takeModelAllowance("member-b", now).allowed).toBe(true);
  });
});
