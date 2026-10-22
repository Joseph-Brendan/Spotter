import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { PERMISSIONS } from "@/lib/permissions";
import { staffCan } from "@/server/auth/authorization";
import { getStaffSession } from "@/server/auth/session";
import {
  getLatestOwnerReviewSnapshot,
  runOwnerReviewSweep,
} from "@/server/jobs/owner-review-sweep";
import { getAnswerAuditSample } from "@/server/review/answer-audit-service";

export async function GET() {
  const session = await getStaffSession();

  if (
    !session ||
    (session.role !== "OWNER" && !staffCan(session, PERMISSIONS.OWNER_REVIEW_ACCESS))
  ) {
    return NextResponse.json({ error: "Forbidden: Owner access required." }, { status: 403 });
  }

  // Retrieve pre-computed snapshot without on-the-fly aggregation
  let snapshot = await getLatestOwnerReviewSnapshot({ gymId: session.gymId });

  // If no snapshot exists yet, run an initial sweep to seed the snapshot
  if (!snapshot) {
    snapshot = await runOwnerReviewSweep({ gymId: session.gymId });
  }

  // Pull initial 20-question audit sample
  const auditSample = await getAnswerAuditSample(20, session.gymId);

  return NextResponse.json({
    success: true,
    simulationMode: env.CHECKIN_SIMULATED,
    snapshot,
    auditSample,
    staff: {
      id: session.staffId,
      name: session.name,
      role: session.role,
      gymId: session.gymId,
    },
  });
}
