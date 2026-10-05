import "server-only";
import { cookies } from "next/headers";

const MEMBER_SESSION_COOKIE = "spotter_session";
const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 days per rules/auth.md

export interface SessionData {
  memberId: string;
  email: string;
  name: string;
  memberNumber: string;
}

/**
 * Creates and sets the member session cookie.
 */
export async function createMemberSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const payload = Buffer.from(JSON.stringify(data)).toString("base64");

  cookieStore.set(MEMBER_SESSION_COOKIE, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Reads and validates the current member session.
 * This is the ONLY place session data is retrieved.
 */
export async function getMemberSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(MEMBER_SESSION_COOKIE);

  if (!cookie?.value) {
    return null;
  }

  try {
    const raw = Buffer.from(cookie.value, "base64").toString("utf-8");
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed.memberId || !parsed.email) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clears the member session cookie.
 */
export async function destroyMemberSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(MEMBER_SESSION_COOKIE);
}
