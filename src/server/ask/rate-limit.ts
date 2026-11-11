import "server-only";

/**
 * Per-member allowance for prototype model calls.
 *
 * This is not the provider quota tracker rules/ai.md describes; that one is
 * global and reads its numbers from the provider before launch. This one stops
 * a single signed-in member from draining the free tier while the prototype
 * stands in for the ask pipeline.
 *
 * In memory, like src/server/auth/rate-limit.ts, so it resets when the process
 * restarts and is per instance. The real ask module should count today's
 * QuestionLog rows instead, which needs no table and survives a restart
 * (docs/spotter-status-and-rag-plan.md, protection).
 *
 * The window and the limit are proposals. The free tier is roughly ten to
 * fifteen requests a minute for the whole gym, so ten a minute for one member
 * is deliberately conservative. Confirm both numbers before launch.
 */

export const CHAT_RATE_WINDOW_MS = 60 * 1000;
export const CHAT_RATE_LIMIT = 10;

interface Allowance {
  count: number;
  windowStartedAt: number;
}

const allowances = new Map<string, Allowance>();

export interface AllowanceResult {
  allowed: boolean;
  /** Seconds until the window resets. Zero when allowed. */
  retryAfterSeconds: number;
}

/**
 * Counts one model request against the member's window.
 *
 * A blocked attempt does not extend the window, so a member who keeps tapping
 * is released when the original minute ends rather than being pushed back
 * forever.
 */
export function takeModelAllowance(
  memberId: string,
  now: number = Date.now()
): AllowanceResult {
  const entry = allowances.get(memberId);

  if (!entry || now - entry.windowStartedAt >= CHAT_RATE_WINDOW_MS) {
    allowances.set(memberId, { count: 1, windowStartedAt: now });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= CHAT_RATE_LIMIT) {
    const remainingMs = entry.windowStartedAt + CHAT_RATE_WINDOW_MS - now;

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    };
  }

  entry.count += 1;

  return { allowed: true, retryAfterSeconds: 0 };
}
