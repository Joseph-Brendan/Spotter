import "server-only";
import { prisma } from "@/server/db";

export type CheckInCodeState = "none" | "waiting" | "checkedIn" | "expired";

// Reports on the member's most recent code only. Never returns the digits.
export async function getCheckInCodeState(
  memberId: string
): Promise<CheckInCodeState> {
  const latest = await prisma.checkInCode.findFirst({
    where: { memberId },
    orderBy: { createdAt: "desc" },
    select: { consumedAt: true, expiresAt: true },
  });

  await prisma.privateAccessLog.create({
    data: {
      sessionMemberId: memberId,
      targetMemberId: memberId,
      functionName: "getCheckInCodeState",
    },
  });

  if (!latest) {
    return "none";
  }

  if (latest.consumedAt) {
    return "checkedIn";
  }

  return latest.expiresAt.getTime() > Date.now() ? "waiting" : "expired";
}
