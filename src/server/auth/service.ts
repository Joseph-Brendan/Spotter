import "server-only";
import type { Algorithm } from "@node-rs/argon2";
import { hash, verify } from "@node-rs/argon2";
import { Prisma } from "@prisma/client";
import { copy } from "@/lib/copy";
import { prisma } from "@/server/db";
import { getReservationEmail } from "@/server/membership/member-numbers";
import { checkBreachedPassword } from "./breached-password";
import { isIpBlocked, recordIpFailure } from "./rate-limit";
import {
  clearMustChangePassword,
  createMemberSession,
  destroyMemberSession,
  getCurrentSessionId,
  getMemberSession,
  revokeMemberSessions,
  type SessionData,
} from "./session";

const PASSWORD_MIN_LENGTH = 8;
const NAME_MIN_LENGTH = 2;
const MEMBER_NUMBER_PATTERN = /^\d{6}$/;
const ACCOUNT_LOCK_THRESHOLD = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

interface MemberIdentity {
  id: string;
  email: string | null;
  name: string | null;
  memberNumber: string;
  emailVerifiedAt: Date | null;
}

function toSessionData(member: MemberIdentity, mustChangePassword: boolean): SessionData {
  return {
    memberId: member.id,
    email: member.email,
    name: member.name ?? "",
    memberNumber: member.memberNumber,
    mustChangePassword,
    emailVerified: member.emailVerifiedAt !== null,
  };
}

const ARGON2ID_ALGORITHM = 2 as Algorithm;

async function hashPasswordValue(password: string): Promise<string> {
  return hash(password, { algorithm: ARGON2ID_ALGORITHM });
}

async function passwordIsBreached(password: string): Promise<boolean> {
  try {
    return await checkBreachedPassword(password);
  } catch (error) {
    console.error(
      "Breached password check failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

async function findMemberByEmail(email: string | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return prisma.member.findUnique({ where: { email: normalized } });
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  memberNumber: string;
  acceptedPrivacy?: boolean;
  ip?: string;
}

export interface ResetPasswordInput {
  email: string;
  tempPassword: string;
  newPassword: string;
  ip?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  ip?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  session?: SessionData;
}

/**
 * Member sign up handling per rules/auth.md and rules/copy.md
 */
export async function signUpMember(input: SignUpInput): Promise<AuthResult> {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const password = input.password?.trim();
  const memberNumber = input.memberNumber?.trim();
  const ip = input.ip;

  const failure = (error: string): AuthResult => {
    if (ip) {
      recordIpFailure(ip);
    }
    return { success: false, error };
  };

  if (ip && isIpBlocked(ip)) {
    return { success: false, error: copy.login.ipLockout };
  }

  if (!name || name.length < NAME_MIN_LENGTH) {
    return failure(copy.validation.nameMinLength);
  }

  if (!email || !email.includes("@")) {
    return failure(copy.validation.emailInvalid);
  }

  if (!memberNumber || !MEMBER_NUMBER_PATTERN.test(memberNumber)) {
    return failure(copy.validation.memberNumberInvalid);
  }

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return failure(copy.signup.passwordMinLength);
  }

  if (input.acceptedPrivacy !== true) {
    return failure(copy.validation.acceptTermsRequired);
  }

  if (await passwordIsBreached(password)) {
    return failure(copy.signup.passwordBreached);
  }

  const gym = await prisma.gym.findFirst({ orderBy: { createdAt: "asc" } });
  if (!gym) {
    return failure(copy.signup.memberNumberNotFound);
  }

  const existingEmail = await prisma.member.findUnique({ where: { email } });
  if (existingEmail) {
    return failure(copy.signup.emailAlreadyRegistered);
  }

  const member = await prisma.member.findUnique({
    where: { gymId_memberNumber: { gymId: gym.id, memberNumber } },
  });

  if (!member) {
    return failure(copy.signup.memberNumberNotFound);
  }

  const reservationEmail = await getReservationEmail(gym.id, memberNumber);

  if (reservationEmail && reservationEmail !== email) {
    return failure(copy.signup.memberNumberReservedForAnotherEmail);
  }

  const passwordHash = await hashPasswordValue(password);
  const now = new Date();

  let claimed: { count: number };
  try {
    claimed = await prisma.member.updateMany({
      where: { id: member.id, accountCreatedAt: null },
      data: {
        name,
        email,
        passwordHash,
        accountCreatedAt: now,
        passwordChangedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return failure(copy.signup.emailAlreadyRegistered);
    }
    throw error;
  }

  if (claimed.count === 0) {
    return failure(copy.signup.memberNumberAlreadyHasAccount);
  }

  await createMemberSession(member.id);

  return {
    success: true,
    session: toSessionData({ ...member, name, email }, false),
  };
}

/**
 * Member login handling per rules/auth.md and rules/copy.md
 */
export async function loginMember(input: LoginInput): Promise<AuthResult> {
  const email = input.email?.trim().toLowerCase();
  const password = input.password?.trim();
  const ip = input.ip;

  const failure = (error: string): AuthResult => {
    if (ip) {
      recordIpFailure(ip);
    }
    return { success: false, error };
  };

  if (ip && isIpBlocked(ip)) {
    return { success: false, error: copy.login.ipLockout };
  }

  if (!email || !password) {
    return failure(copy.login.failed);
  }

  const member = await prisma.member.findUnique({ where: { email } });

  if (member?.deletionRequestedAt) {
    return { success: false, error: copy.deletion.accountScheduled };
  }

  if (member?.lockedUntil && member.lockedUntil.getTime() > Date.now()) {
    return { success: false, error: copy.login.lockout };
  }

  const passwordMatches =
    member?.passwordHash ? await verify(member.passwordHash, password) : false;

  if (member && passwordMatches) {
    await prisma.member.update({
      where: { id: member.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    await createMemberSession(member.id);
    return { success: true, session: toSessionData(member, false) };
  }

  const tempMatches =
    member?.tempPasswordHash && member.tempPasswordExpiresAt
      ? member.tempPasswordExpiresAt.getTime() > Date.now()
        ? await verify(member.tempPasswordHash, password)
        : false
      : false;

  if (member && tempMatches) {
    await prisma.member.update({
      where: { id: member.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    await createMemberSession(member.id, { mustChangePassword: true });
    return { success: true, session: toSessionData(member, true) };
  }

  if (member) {
    const failedCount = member.failedLoginCount + 1;
    await prisma.member.update({
      where: { id: member.id },
      data:
        failedCount >= ACCOUNT_LOCK_THRESHOLD
          ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + ACCOUNT_LOCK_MS) }
          : { failedLoginCount: failedCount },
    });
  }

  return failure(copy.login.failed);
}

/**
 * Member password change with an owner-issued temporary password per rules/auth.md
 */
export async function resetPasswordMember(input: ResetPasswordInput): Promise<AuthResult> {
  const newPassword = input.newPassword?.trim();
  const tempPassword = input.tempPassword?.trim();
  const ip = input.ip;

  const failure = (error: string): AuthResult => {
    if (ip) {
      recordIpFailure(ip);
    }
    return { success: false, error };
  };

  if (ip && isIpBlocked(ip)) {
    return { success: false, error: copy.login.ipLockout };
  }

  if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
    return failure(copy.signup.passwordMinLength);
  }

  if (await passwordIsBreached(newPassword)) {
    return failure(copy.signup.passwordBreached);
  }

  const currentSession = await getMemberSession();

  const member = currentSession
    ? await prisma.member.findUnique({ where: { id: currentSession.memberId } })
    : await findMemberByEmail(input.email);

  if (!member) {
    return failure(copy.login.failed);
  }

  if (!member.tempPasswordHash || !member.tempPasswordExpiresAt) {
    return failure(copy.tempPassword.deskNotice);
  }

  if (member.tempPasswordExpiresAt.getTime() <= Date.now()) {
    return failure(copy.tempPassword.expired);
  }

  if (!tempPassword || !(await verify(member.tempPasswordHash, tempPassword))) {
    return failure(copy.login.failed);
  }

  const passwordHash = await hashPasswordValue(newPassword);

  await prisma.member.update({
    where: { id: member.id },
    data: {
      passwordHash,
      tempPasswordHash: null,
      tempPasswordExpiresAt: null,
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  const currentSessionId = await getCurrentSessionId();
  await revokeMemberSessions(member.id, currentSessionId ?? undefined);

  if (currentSessionId) {
    await clearMustChangePassword(currentSessionId);
  }

  return {
    success: true,
    ...(currentSessionId ? { session: toSessionData(member, false) } : {}),
  };
}

/**
 * Logout member
 */
export async function logoutMember(): Promise<void> {
  await destroyMemberSession();
}

/**
 * Get current authenticated member
 */
export async function getCurrentMember(): Promise<SessionData | null> {
  return await getMemberSession();
}

export async function verifyMemberPassword(
  memberId: string,
  password: string
): Promise<boolean> {
  if (!password) {
    return false;
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { passwordHash: true },
  });

  if (!member?.passwordHash) {
    return false;
  }

  return verify(member.passwordHash, password);
}
