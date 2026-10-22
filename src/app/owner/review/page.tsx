import type { Metadata } from "next";
import { redirect } from "next/navigation";
import OwnerReviewDashboard from "@/components/owner/owner-review-dashboard";
import { env } from "@/lib/env";
import { PERMISSIONS } from "@/lib/permissions";
import { staffCan } from "@/server/auth/authorization";
import { getStaffSession } from "@/server/auth/session";
import {
  getLatestOwnerReviewSnapshot,
  runOwnerReviewSweep,
} from "@/server/jobs/owner-review-sweep";
import { getAnswerAuditSample } from "@/server/review/answer-audit-service";

export const metadata: Metadata = {
  title: "Owner Review & Anomaly Dashboard | Spotter",
};

export const dynamic = "force-dynamic";

export default async function OwnerReviewPage() {
  const session = await getStaffSession();

  if (
    !session ||
    (session.role !== "OWNER" && !staffCan(session, PERMISSIONS.OWNER_REVIEW_ACCESS))
  ) {
    redirect("/staff/login?redirect=/owner/review");
  }

  // Load latest pre-computed snapshot (no on-the-fly heavy aggregations)
  let snapshot = await getLatestOwnerReviewSnapshot({ gymId: session.gymId });

  // Initial seed if no snapshot exists yet
  if (!snapshot) {
    snapshot = await runOwnerReviewSweep({ gymId: session.gymId });
  }

  // Initial 20-sample question audit
  const auditSample = await getAnswerAuditSample(20, session.gymId);

  return (
    <OwnerReviewDashboard
      initialSnapshot={snapshot}
      initialAuditSample={auditSample}
      simulationMode={env.CHECKIN_SIMULATED}
      staff={{
        id: session.staffId,
        name: session.name,
        role: session.role,
        gymId: session.gymId,
      }}
    />
  );
}
