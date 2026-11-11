import "server-only";

// Wrong entries at the open simulated keypad, per client IP. Six digits make
// guessing a live code slow; this makes it slower.
const WINDOW_MS = 10 * 60 * 1000;
const REFUSAL_LIMIT = 20;

interface RefusalRecord {
  count: number;
  windowStart: number;
}

const refusals = new Map<string, RefusalRecord>();

export function isKeypadBlocked(ip: string): boolean {
  const entry = refusals.get(ip);

  if (!entry) {
    return false;
  }

  if (Date.now() - entry.windowStart > WINDOW_MS) {
    refusals.delete(ip);
    return false;
  }

  return entry.count >= REFUSAL_LIMIT;
}

export function recordKeypadRefusal(ip: string): void {
  const now = Date.now();
  const entry = refusals.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    refusals.set(ip, { count: 1, windowStart: now });
    return;
  }

  entry.count += 1;
}
