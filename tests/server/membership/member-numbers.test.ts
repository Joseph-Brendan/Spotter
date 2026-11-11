import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  listMemberNumberReservations,
  reserveMemberNumber,
} from "@/server/membership/member-numbers";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("member number reservation", () => {
  beforeEach(async () => {
    await prisma.memberSession.deleteMany();
    await prisma.memberNumberReservation.deleteMany();
    await prisma.staffSession.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.member.deleteMany();
    await prisma.gym.deleteMany();
  });

  async function createGymAndStaff() {
    const gym = await prisma.gym.create({
      data: {
        name: "Test Gym",
        timezone: "Africa/Lagos",
        openingTime: "06:00",
        closingTime: "22:00",
        graceDays: 7,
      },
    });

    const staff = await prisma.staff.create({
      data: {
        gym: { connect: { id: gym.id } },
        name: "Reception Staff",
        email: "reception@example.com",
        passwordHash: "not-used-by-this-test",
        role: { connect: { key: "STAFF" } },
      },
    });

    return { gym, staff };
  }

  it("reserves distinct six digit numbers and stamps the staff member", async () => {
    const { gym, staff } = await createGymAndStaff();

    const first = await reserveMemberNumber({
      gymId: gym.id,
      staffId: staff.id,
      email: "member@example.com",
    });
    const second = await reserveMemberNumber({
      gymId: gym.id,
      staffId: staff.id,
      email: "member@example.com",
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.memberNumber).toMatch(/^\d{6}$/);
    expect(second.memberNumber).toMatch(/^\d{6}$/);
    expect(first.memberNumber).not.toBe(second.memberNumber);

    const reservations = await prisma.memberNumberReservation.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: "asc" },
    });

    expect(reservations).toHaveLength(2);
    expect(reservations.every((row) => row.createdByStaffId === staff.id)).toBe(
      true
    );
    expect(reservations.every((row) => row.email === "member@example.com")).toBe(
      true
    );

    const members = await prisma.member.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: "asc" },
    });

    expect(members).toHaveLength(2);
    expect(members.map((row) => row.memberNumber).sort()).toEqual(
      [first.memberNumber, second.memberNumber].sort()
    );
    expect(
      members.every(
        (row) =>
          row.name === null &&
          row.expiryDate === null &&
          row.email === null &&
          row.passwordHash === null &&
          row.accountCreatedAt === null
      )
    ).toBe(true);

    const history = await listMemberNumberReservations({
      gymId: gym.id,
      staffId: staff.id,
      page: 1,
      search: "",
      includeEmail: true,
    });

    expect(history.timezone).toBe("Africa/Lagos");
    expect(history.pagination).toEqual({
      page: 1,
      pageSize: 5,
      totalCount: 2,
      totalPages: 1,
    });
    expect(history.reservations).toHaveLength(2);
    expect(history.reservations.every((row) => row.claimedAt === null)).toBe(
      true
    );
    expect(
      history.reservations.every((row) => row.email === "member@example.com")
    ).toBe(true);
    expect(
      history.reservations.map((row) => row.memberNumber).sort()
    ).toEqual([first.memberNumber, second.memberNumber].sort());

    const staffHistory = await listMemberNumberReservations({
      gymId: gym.id,
      staffId: staff.id,
      page: 1,
      search: "",
      includeEmail: false,
    });

    expect(
      staffHistory.reservations.every((row) => !("email" in row))
    ).toBe(true);

    const claimedAt = new Date("2026-11-01T10:00:00.000Z");

    await prisma.memberNumberReservation.update({
      where: {
        gymId_memberNumber: {
          gymId: gym.id,
          memberNumber: first.memberNumber as string,
        },
      },
      data: { claimedAt },
    });

    const afterClaim = await listMemberNumberReservations({
      gymId: gym.id,
      staffId: staff.id,
      page: 1,
      search: "",
      includeEmail: true,
    });
    const claimedRow = afterClaim.reservations.find(
      (row) => row.memberNumber === first.memberNumber
    );

    expect(claimedRow?.claimedAt).toBe(claimedAt.toISOString());
  });

  it("returns five reservations per page and clamps out-of-range pages", async () => {
    const { gym, staff } = await createGymAndStaff();

    for (let index = 0; index < 6; index += 1) {
      const result = await reserveMemberNumber({
        gymId: gym.id,
        staffId: staff.id,
        email: `member${index}@example.com`,
      });

      expect(result.success).toBe(true);
    }

    const firstPage = await listMemberNumberReservations({
      gymId: gym.id,
      staffId: staff.id,
      page: 1,
      search: "",
      includeEmail: true,
    });

    expect(firstPage.reservations).toHaveLength(5);
    expect(firstPage.pagination).toEqual({
      page: 1,
      pageSize: 5,
      totalCount: 6,
      totalPages: 2,
    });

    const secondPage = await listMemberNumberReservations({
      gymId: gym.id,
      staffId: staff.id,
      page: 2,
      search: "",
      includeEmail: true,
    });

    expect(secondPage.reservations).toHaveLength(1);
    expect(secondPage.pagination).toEqual({
      page: 2,
      pageSize: 5,
      totalCount: 6,
      totalPages: 2,
    });

    const clampedPage = await listMemberNumberReservations({
      gymId: gym.id,
      staffId: staff.id,
      page: 99,
      search: "",
      includeEmail: true,
    });

    expect(clampedPage.pagination.page).toBe(2);
    expect(clampedPage.reservations).toHaveLength(1);
  });

  it("fuzzy searches member numbers", async () => {
    const { gym, staff } = await createGymAndStaff();

    const joseph = await reserveMemberNumber({
      gymId: gym.id,
      staffId: staff.id,
      email: "joseph@example.com",
    });
    const amaka = await reserveMemberNumber({
      gymId: gym.id,
      staffId: staff.id,
      email: "amaka@example.com",
    });

    expect(joseph.success).toBe(true);
    expect(amaka.success).toBe(true);

    const number = joseph.memberNumber as string;
    const lastDigit = Number(number[5]);
    const typo = `${number.slice(0, 5)}${(lastDigit + 1) % 10}`;

    const byNumberTypo = await listMemberNumberReservations({
      gymId: gym.id,
      staffId: staff.id,
      page: 1,
      search: typo,
      includeEmail: true,
    });

    expect(byNumberTypo.reservations.map((row) => row.memberNumber)).toContain(
      joseph.memberNumber
    );
    expect(byNumberTypo.pagination.totalCount).toBeGreaterThanOrEqual(1);

    const byEmailTypo = await listMemberNumberReservations({
      gymId: gym.id,
      staffId: staff.id,
      page: 1,
      search: "josph",
      includeEmail: true,
    });

    expect(byEmailTypo.reservations.map((row) => row.memberNumber)).toContain(
      joseph.memberNumber
    );

    const staffEmailSearch = await listMemberNumberReservations({
      gymId: gym.id,
      staffId: staff.id,
      page: 1,
      search: "josph",
      includeEmail: false,
    });

    expect(staffEmailSearch.pagination.totalCount).toBe(0);
  });
});
