import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions";
import { staffCan } from "@/server/auth/authorization";
import { getStaffSession } from "@/server/auth/session";
import { runOwnerReviewSweep } from "@/server/jobs/owner-review-sweep";

export async function POST() {
  const session = await getStaffSession();

  if (
    !session ||
    (session.role !== "OWNER" && !staffCan(session, PERMISSIONS.OWNER_REVIEW_ACCESS))
  ) {
    return NextResponse.json(
      { error: "Forbidden: Owner access required to run review sweep." },
      { status: 403 }
    );
  }

  const snapshot = await runOwnerReviewSweep({ gymId: session.gymId });

  return NextResponse.json({
    success: true,
    snapshot,
  });
}
