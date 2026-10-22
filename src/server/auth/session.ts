import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/server/db";

const MEMBER_SESSION_COOKIE = "spotter_session";
const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const STAFF_SESSION_COOKIE = "spotter_staff_session";
const STAFF_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const STAFF_SESSION_PATH = "/";

export interface SessionData {
  memberId: string;
  email: string | null;
  name: string;
  memberNumber: string;
  mustChangePassword: boolean;
  emailVerified: boolean;
}

export interface StaffSessionData {
  staffId: string;
  gymId: string;
  name: string;
  role: string;
  permissions: string[];
}

function staffSessionSecret(): string {
  if (!env.STAFF_SESSION_SECRET) {
    throw new Error(
      "Missing required environment variable STAFF_SESSION_SECRET. See rules/env.md and .env.example."
    );
  }

  if (env.STAFF_SESSION_SECRET === env.SESSION_SECRET) {
    throw new Error("STAFF_SESSION_SECRET must differ from SESSION_SECRET.");
  }

  return env.STAFF_SESSION_SECRET;
}

function staffSessionSecretOrNull(): string | null {
  if (
    !env.STAFF_SESSION_SECRET ||
    env.STAFF_SESSION_SECRET === env.SESSION_SECRET
  ) {
    return null;
  }

  return env.STAFF_SESSION_SECRET;
}

function signToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseCookieValue(value: string): { token: string; signature: string } | null {
  const separator = value.lastIndexOf(".");
  if (separator <= 0) {
    return null;
  }

  return {
    token: value.slice(0, separator),
    signature: value.slice(separator + 1),
  };
}

function signatureMatches(token: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(signToken(token, secret));
  const received = Buffer.from(signature);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

function buildCookieValue(token: string, secret: string): string {
  return `${token}.${signToken(token, secret)}`;
}

function parseSignedCookie(
  value: string,
  secret: string
): { token: string; signature: string } | null {
  const parsed = parseCookieValue(value);
  if (!parsed || !signatureMatches(parsed.token, parsed.signature, secret)) {
    return null;
  }

  return parsed;
}

async function lookupSession(token: string) {
  const session = await prisma.memberSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      mustChangePassword: true,
      revokedAt: true,
      expiresAt: true,
      member: {
        select: {
          id: true,
          email: true,
          name: true,
          memberNumber: true,
          emailVerifiedAt: true,
          deletionRequestedAt: true,
        },
      },
    },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now() ||
    session.member.deletionRequestedAt !== null
  ) {
    return null;
  }

  return session;
}

function buildSessionData(session: {
  mustChangePassword: boolean;
  member: {
    id: string;
    email: string | null;
    name: string;
    memberNumber: string;
    emailVerifiedAt: Date | null;
  };
}): SessionData {
  return {
    memberId: session.member.id,
    email: session.member.email,
    name: session.member.name,
    memberNumber: session.member.memberNumber,
    mustChangePassword: session.mustChangePassword,
    emailVerified: session.member.emailVerifiedAt !== null,
  };
}

async function resolveSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(MEMBER_SESSION_COOKIE);

  if (!cookie?.value) {
    return null;
  }

  const parsed = parseSignedCookie(cookie.value, env.SESSION_SECRET);
  if (!parsed) {
    return null;
  }

  const session = await lookupSession(parsed.token);
  if (!session) {
    return null;
  }

  return { session, cookieValue: cookie.value };
}

/**
 * Creates a member session row and sets the signed session cookie.
 */
export async function createMemberSession(
  memberId: string,
  options?: { mustChangePassword?: boolean }
): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  await prisma.memberSession.create({
    data: {
      memberId,
      tokenHash: hashToken(token),
      mustChangePassword: options?.mustChangePassword ?? false,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(MEMBER_SESSION_COOKIE, buildCookieValue(token, env.SESSION_SECRET), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
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
  const resolved = await resolveSession();
  if (!resolved) {
    return null;
  }

  const { session, cookieValue } = resolved;
  const now = new Date();

  await prisma.memberSession.update({
    where: { id: session.id },
    data: {
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(MEMBER_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return buildSessionData(session);
}

export async function getMemberSessionFromRequest(
  request: NextRequest
): Promise<SessionData | null> {
  const cookie = request.cookies.get(MEMBER_SESSION_COOKIE);

  if (!cookie?.value) {
    return null;
  }

  const parsed = parseSignedCookie(cookie.value, env.SESSION_SECRET);
  if (!parsed) {
    return null;
  }

  const session = await lookupSession(parsed.token);
  if (!session) {
    return null;
  }

  return buildSessionData(session);
}

export async function getCurrentSessionId(): Promise<string | null> {
  const resolved = await resolveSession();
  return resolved?.session.id ?? null;
}

export async function revokeMemberSessions(
  memberId: string,
  exceptSessionId?: string
): Promise<void> {
  await prisma.memberSession.updateMany({
    where: {
      memberId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function clearMustChangePassword(sessionId: string): Promise<void> {
  await prisma.memberSession.update({
    where: { id: sessionId },
    data: { mustChangePassword: false },
  });
}

/**
 * Clears the member session cookie and revokes its session row.
 */
export async function destroyMemberSession(): Promise<void> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(MEMBER_SESSION_COOKIE);

  if (cookie?.value) {
    const parsed = parseCookieValue(cookie.value);
    if (parsed && signatureMatches(parsed.token, parsed.signature, env.SESSION_SECRET)) {
      await prisma.memberSession.updateMany({
        where: { tokenHash: hashToken(parsed.token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  cookieStore.delete(MEMBER_SESSION_COOKIE);
}

async function lookupStaffSession(token: string) {
  const session = await prisma.staffSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      revokedAt: true,
      expiresAt: true,
      staff: {
        select: {
          id: true,
          gymId: true,
          name: true,
          role: {
            select: {
              key: true,
              permissions: {
                select: {
                  permission: {
                    select: { key: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  return session;
}

interface StaffWithRole {
  id: string;
  gymId: string;
  name: string;
  role: {
    key: string;
    permissions: Array<{ permission: { key: string } }>;
  };
}

export function buildStaffSessionData(staff: StaffWithRole): StaffSessionData {
  return {
    staffId: staff.id,
    gymId: staff.gymId,
    name: staff.name,
    role: staff.role.key,
    permissions: staff.role.permissions.map(
      (rolePermission) => rolePermission.permission.key
    ),
  };
}

/**
 * Creates a staff session row and sets the signed staff session cookie.
 */
export async function createStaffSession(staffId: string): Promise<void> {
  const secret = staffSessionSecret();
  const token = randomBytes(32).toString("base64url");

  await prisma.staffSession.create({
    data: {
      staffId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + STAFF_SESSION_MAX_AGE_SECONDS * 1000),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE, buildCookieValue(token, secret), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: STAFF_SESSION_PATH,
    maxAge: STAFF_SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Reads and validates the current staff session.
 */
export async function getStaffSession(): Promise<StaffSessionData | null> {
  const secret = staffSessionSecretOrNull();
  if (!secret) {
    return null;
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.get(STAFF_SESSION_COOKIE);

  if (!cookie?.value) {
    return null;
  }

  const parsed = parseSignedCookie(cookie.value, secret);
  if (!parsed) {
    return null;
  }

  const session = await lookupStaffSession(parsed.token);
  if (!session) {
    return null;
  }

  return buildStaffSessionData(session.staff);
}

export async function getStaffSessionFromRequest(
  request: NextRequest
): Promise<StaffSessionData | null> {
  const secret = staffSessionSecretOrNull();
  if (!secret) {
    return null;
  }

  const cookie = request.cookies.get(STAFF_SESSION_COOKIE);
  if (!cookie?.value) {
    return null;
  }

  const parsed = parseSignedCookie(cookie.value, secret);
  if (!parsed) {
    return null;
  }

  const session = await lookupStaffSession(parsed.token);
  if (!session) {
    return null;
  }

  return buildStaffSessionData(session.staff);
}

/**
 * Clears the staff session cookie and revokes its session row.
 */
export async function destroyStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(STAFF_SESSION_COOKIE);
  const secret = staffSessionSecretOrNull();

  if (cookie?.value && secret) {
    const parsed = parseCookieValue(cookie.value);
    if (parsed && signatureMatches(parsed.token, parsed.signature, secret)) {
      await prisma.staffSession.updateMany({
        where: { tokenHash: hashToken(parsed.token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  cookieStore.set(STAFF_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: STAFF_SESSION_PATH,
    maxAge: 0,
  });
}
