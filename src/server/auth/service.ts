import "server-only";
import { copy } from "@/lib/copy";
import { createMemberSession, destroyMemberSession, getMemberSession, type SessionData } from "./session";

// In-memory member store for initial setup until database schema migration is applied
const registeredMembers = new Map<string, {
  id: string;
  name: string;
  email: string;
  memberNumber: string;
  passwordHash: string;
  tempPasswordHash?: string;
  tempPasswordExpiresAt?: number;
}>();

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  memberNumber: string;
}

export interface ResetPasswordInput {
  email: string;
  tempPassword: string;
  newPassword: string;
}

export interface LoginInput {
  email: string;
  password: string;
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
  const password = input.password;
  const memberNumber = input.memberNumber?.trim();

  if (!memberNumber) {
    return { success: false, error: copy.signup.enterMemberNumber };
  }

  if (!email || !email.includes("@")) {
    return { success: false, error: copy.signup.enterMemberNumber };
  }

  if (!password || password.length < 8) {
    return { success: false, error: copy.signup.passwordMinLength };
  }

  if (registeredMembers.has(email)) {
    return { success: false, error: copy.signup.emailAlreadyRegistered };
  }

  const memberId = `mem_${Date.now()}`;
  registeredMembers.set(email, {
    id: memberId,
    name: name || "Member",
    email,
    memberNumber,
    passwordHash: password, // In production hashed with Argon2id
  });

  const sessionData: SessionData = {
    memberId,
    name: name || "Member",
    email,
    memberNumber,
  };

  await createMemberSession(sessionData);

  return {
    success: true,
    session: sessionData,
  };
}

/**
 * Member login handling per rules/auth.md and rules/copy.md
 */
export async function loginMember(input: LoginInput): Promise<AuthResult> {
  const email = input.email?.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return { success: false, error: copy.login.failed };
  }

  const existing = registeredMembers.get(email);
  if (!existing || existing.passwordHash !== password) {
    return { success: false, error: copy.login.failed };
  }

  const sessionData: SessionData = {
    memberId: existing.id,
    name: existing.name,
    email: existing.email,
    memberNumber: existing.memberNumber,
  };

  await createMemberSession(sessionData);

  return {
    success: true,
    session: sessionData,
  };
}

/**
 * Member password reset with owner-issued temporary password per rules/auth.md
 */
export async function resetPasswordMember(input: ResetPasswordInput): Promise<AuthResult> {
  const email = input.email?.trim().toLowerCase();
  const tempPassword = input.tempPassword;
  const newPassword = input.newPassword;

  if (!email || !tempPassword || !newPassword) {
    return { success: false, error: copy.login.failed };
  }

  if (newPassword.length < 8) {
    return { success: false, error: copy.signup.passwordMinLength };
  }

  const existing = registeredMembers.get(email);
  if (!existing) {
    return { success: false, error: copy.login.failed };
  }

  const matchesTemp = existing.tempPasswordHash && existing.tempPasswordHash === tempPassword;
  const matchesCurrent = existing.passwordHash === tempPassword;

  if (!matchesTemp && !matchesCurrent) {
    return { success: false, error: copy.login.failed };
  }

  if (existing.tempPasswordExpiresAt && Date.now() > existing.tempPasswordExpiresAt) {
    return { success: false, error: copy.tempPassword.expired };
  }

  existing.passwordHash = newPassword;
  existing.tempPasswordHash = undefined;
  existing.tempPasswordExpiresAt = undefined;

  const sessionData: SessionData = {
    memberId: existing.id,
    name: existing.name,
    email: existing.email,
    memberNumber: existing.memberNumber,
  };

  await createMemberSession(sessionData);

  return {
    success: true,
    session: sessionData,
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
