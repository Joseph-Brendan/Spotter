import "server-only";
import { verify } from "@node-rs/argon2";
import { copy } from "@/lib/copy";
import { prisma } from "@/server/db";
import { isIpBlocked, recordIpFailure } from "./rate-limit";
import {
  buildStaffSessionData,
  createStaffSession,
  destroyStaffSession,
  type StaffSessionData,
} from "./session";

const STAFF_LOCK_THRESHOLD = 5;
const STAFF_LOCK_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$ARiQYeCO0CwS8tg2guQwxg$lW8RXRiqaGf1/QL7KFTkPR1DB5Sy4HBR2yRbRJgKVvE";

export interface StaffLoginInput {
  email: string;
  password: string;
  ip?: string;
}

export interface StaffAuthResult {
  success: boolean;
  error?: string;
  session?: StaffSessionData;
}

export async function loginStaff(input: StaffLoginInput): Promise<StaffAuthResult> {
  const email = input.email?.trim().toLowerCase();
  const password = input.password ?? "";
  const ip = input.ip;

  const failure = (error: string = copy.login.failed): StaffAuthResult => {
    if (ip) {
      recordIpFailure(ip);
    }
    return { success: false, error };
  };

  if (ip && isIpBlocked(ip)) {
    return { success: false, error: copy.login.ipLockout };
  }

  if (!email || !password) {
    return failure();
  }

  const staff = await prisma.staff.findUnique({
    where: { email },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (staff?.lockedUntil && staff.lockedUntil.getTime() > Date.now()) {
    await verify(DUMMY_PASSWORD_HASH, password).catch(() => false);
    return failure(copy.login.lockout);
  }

  let passwordMatches = false;

  try {
    passwordMatches = staff
      ? await verify(staff.passwordHash, password)
      : await verify(DUMMY_PASSWORD_HASH, password);
  } catch {
    passwordMatches = false;
  }

  if (staff && passwordMatches) {
    await prisma.staff.update({
      where: { id: staff.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    await createStaffSession(staff);

    return {
      success: true,
      session: buildStaffSessionData(staff),
    };
  }

  if (staff) {
    const failedCount = staff.failedLoginCount + 1;
    await prisma.staff.update({
      where: { id: staff.id },
      data:
        failedCount >= STAFF_LOCK_THRESHOLD
          ? {
              failedLoginCount: 0,
              lockedUntil: new Date(Date.now() + STAFF_LOCK_MS),
            }
          : { failedLoginCount: failedCount },
    });
  }

  return failure();
}

export async function logoutStaff(): Promise<void> {
  await destroyStaffSession();
}
