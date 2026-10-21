import { hash, verify } from "@node-rs/argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";
import { prisma } from "@/server/db";
import { loginMember, resetPasswordMember, signUpMember } from "@/server/auth/service";

const { cookieStore } = vi.hoisted(() => ({
  cookieStore: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) as string } : undefined,
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

async function createGymWithMember(data: {
  memberNumber: string;
  email: string | null;
  passwordHash: string | null;
  tempPasswordHash?: string | null;
  tempPasswordExpiresAt?: Date | null;
  accountCreatedAt?: Date | null;
}) {
  const gym = await prisma.gym.create({
    data: {
      name: "Test Gym",
      timezone: "Africa/Lagos",
      openingTime: "06:00",
      closingTime: "22:00",
      graceDays: 7,
    },
  });

  const member = await prisma.member.create({
    data: {
      gymId: gym.id,
      name: "Test Member",
      memberNumber: data.memberNumber,
      expiryDate: new Date("2027-01-01"),
      email: data.email,
      passwordHash: data.passwordHash,
      tempPasswordHash: data.tempPasswordHash ?? null,
      tempPasswordExpiresAt: data.tempPasswordExpiresAt ?? null,
      accountCreatedAt: data.accountCreatedAt ?? null,
    },
  });

  return { gym, member };
}

describe.skipIf(!hasTestDatabase)("auth service", () => {
  beforeEach(async () => {
    cookieStore.clear();
    await prisma.memberSession.deleteMany();
    await prisma.memberNumberReservation.deleteMany();
    await prisma.staffSession.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.member.deleteMany();
    await prisma.gym.deleteMany();
  });

  it("does not create a member when sign up has no matching member record", async () => {
    await prisma.gym.create({
      data: {
        name: "Test Gym",
        timezone: "Africa/Lagos",
        openingTime: "06:00",
        closingTime: "22:00",
        graceDays: 7,
      },
    });

    const result = await signUpMember({
      name: "Unregistered Person",
      email: "unregistered@example.com",
      password: "safe-password-123",
      memberNumber: "999999",
      acceptedPrivacy: true,
    });

    expect(result).toEqual({
      success: false,
      error: copy.signup.memberNumberNotFound,
    });
    expect(await prisma.member.count()).toBe(0);
  });

  it("fails sign up for a member number that already has an account and writes nothing", async () => {
    const passwordHash = await hash("original-password");
    const { member } = await createGymWithMember({
      memberNumber: "100001",
      email: "existing@example.com",
      passwordHash,
      accountCreatedAt: new Date("2026-01-01"),
    });

    const memberCountBefore = await prisma.member.count();
    const sessionCountBefore = await prisma.memberSession.count();

    const result = await signUpMember({
      name: "New Person",
      email: "new@example.com",
      password: "new-password-123",
      memberNumber: "100001",
      acceptedPrivacy: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(copy.signup.memberNumberAlreadyHasAccount);
    expect(await prisma.member.count()).toBe(memberCountBefore);
    expect(await prisma.memberSession.count()).toBe(sessionCountBefore);

    const stored = await prisma.member.findUnique({ where: { id: member.id } });
    expect(stored?.email).toBe("existing@example.com");
    expect(stored?.accountCreatedAt?.toISOString()).toBe(member.accountCreatedAt?.toISOString());
  });

  it("rejects sign up when the member number is reserved for another email", async () => {
    const { gym, member } = await createGymWithMember({
      memberNumber: "100003",
      email: null,
      passwordHash: null,
    });

    const staff = await prisma.staff.create({
      data: {
        gym: { connect: { id: gym.id } },
        name: "Reception Staff",
        email: "desk@example.com",
        passwordHash: "not-used-by-this-test",
        role: { connect: { key: "STAFF" } },
      },
    });

    await prisma.memberNumberReservation.create({
      data: {
        gymId: gym.id,
        memberNumber: "100003",
        email: "right@example.com",
        createdByStaffId: staff.id,
      },
    });

    const result = await signUpMember({
      name: "Wrong Person",
      email: "wrong@example.com",
      password: "correct-horse-battery-staple",
      memberNumber: "100003",
      acceptedPrivacy: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(copy.signup.memberNumberReservedForAnotherEmail);

    const stored = await prisma.member.findUnique({ where: { id: member.id } });
    expect(stored?.email).toBeNull();
    expect(stored?.accountCreatedAt).toBeNull();
  });

  it("revokes every other session when the password changes", async () => {
    const oldPasswordHash = await hash("old-password-123");
    const tempPasswordHash = await hash("temp-password-456");
    const { member } = await createGymWithMember({
      memberNumber: "100002",
      email: "member@example.com",
      passwordHash: oldPasswordHash,
      tempPasswordHash,
      tempPasswordExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      accountCreatedAt: new Date("2026-01-01"),
    });

    const login = await loginMember({
      email: "member@example.com",
      password: "temp-password-456",
    });

    expect(login.success).toBe(true);
    expect(login.session?.mustChangePassword).toBe(true);

    await prisma.memberSession.create({
      data: {
        memberId: member.id,
        tokenHash: "other-session-token-hash",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const result = await resetPasswordMember({
      email: "",
      tempPassword: "temp-password-456",
      newPassword: "brand-new-password",
    });

    expect(result.success).toBe(true);

    const sessions = await prisma.memberSession.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: "asc" },
    });

    expect(sessions).toHaveLength(2);

    const current = sessions.find((session) => session.tokenHash !== "other-session-token-hash");
    const other = sessions.find((session) => session.tokenHash === "other-session-token-hash");

    expect(current?.revokedAt).toBeNull();
    expect(current?.mustChangePassword).toBe(false);
    expect(other?.revokedAt).not.toBeNull();

    const updated = await prisma.member.findUnique({ where: { id: member.id } });
    expect(updated?.tempPasswordHash).toBeNull();
    expect(updated?.tempPasswordExpiresAt).toBeNull();
    expect(updated?.passwordHash).not.toBeNull();
    expect(await verify(updated?.passwordHash as string, "brand-new-password")).toBe(true);
  });
});
