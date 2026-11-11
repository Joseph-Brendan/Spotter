import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { verifyCheckInCode } from "@/server/checkin/verifier";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const MINUTE_MS = 60 * 1000;

describe.skipIf(!hasTestDatabase)("verifyCheckInCode", () => {
  beforeEach(async () => {
    await prisma.checkIn.deleteMany();
    await prisma.checkInCode.deleteMany();
    await prisma.privateAccessLog.deleteMany();
    await prisma.memberSession.deleteMany();
    await prisma.member.deleteMany();
    await prisma.gym.deleteMany();
  });

  async function createCode(input: { ageMs?: number; ttlMs?: number } = {}) {
    const gym = await prisma.gym.create({
      data: {
        name: "Test Gym",
        timezone: "Africa/Lagos",
        openingTime: "06:00",
        closingTime: "22:00",
        graceDays: 3,
      },
    });

    const member = await prisma.member.create({
      data: {
        gymId: gym.id,
        name: "Ada",
        memberNumber: "600001",
        tier: "BASIC",
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * MINUTE_MS),
      },
    });

    const createdAt = new Date(Date.now() - (input.ageMs ?? 0));
    const code = await prisma.checkInCode.create({
      data: {
        memberId: member.id,
        code: "123456",
        createdAt,
        expiresAt: new Date(createdAt.getTime() + (input.ttlMs ?? 15 * MINUTE_MS)),
      },
    });

    return { member, code };
  }

  it("consumes a live code and writes one attendance record", async () => {
    const { member, code } = await createCode();

    await expect(verifyCheckInCode("123456", "SIMULATED")).resolves.toEqual({
      status: "checkedIn",
    });

    const consumed = await prisma.checkInCode.findUniqueOrThrow({
      where: { id: code.id },
    });
    const checkIns = await prisma.checkIn.findMany({
      where: { memberId: member.id },
    });

    expect(consumed.consumedAt).not.toBeNull();
    expect(consumed.consumedBy).toBe("SIMULATED");
    expect(checkIns).toHaveLength(1);
    expect(checkIns[0].source).toBe("CODE");
    expect(checkIns[0].checkInCodeId).toBe(code.id);
  });

  it("writes one attendance record when the same code is entered twice", async () => {
    const { member } = await createCode();

    await verifyCheckInCode("123456", "SIMULATED");
    await expect(verifyCheckInCode("123456", "SIMULATED")).resolves.toEqual({
      status: "checkedIn",
    });

    await expect(
      prisma.checkIn.count({ where: { memberId: member.id } })
    ).resolves.toBe(1);
  });

  it("refuses a code older than fifteen minutes", async () => {
    const { member } = await createCode({ ageMs: 16 * MINUTE_MS });

    await expect(verifyCheckInCode("123456", "SIMULATED")).resolves.toEqual({
      status: "refused",
    });
    await expect(
      prisma.checkIn.count({ where: { memberId: member.id } })
    ).resolves.toBe(0);
  });

  it("refuses digits that match no code", async () => {
    await createCode();

    await expect(verifyCheckInCode("654321", "SIMULATED")).resolves.toEqual({
      status: "refused",
    });
    await expect(verifyCheckInCode("12345", "SIMULATED")).resolves.toEqual({
      status: "refused",
    });
  });
});
