import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runOwnerReviewSweep } from "@/server/jobs/owner-review-sweep";
import { purgeExpiredDeletions } from "@/server/jobs/purge-deletions";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!env.CRON_SECRET || authorization !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("Nightly job started");
  const purged = await purgeExpiredDeletions();
  console.log(`Nightly job purged accounts: ${purged}`);

  const sweepSnapshot = await runOwnerReviewSweep();
  console.log(
    `Nightly sweep completed. Snapshot ID: ${sweepSnapshot.id}`
  );

  return NextResponse.json({
    success: true,
    purged,
    sweepSnapshotId: sweepSnapshot.id,
    computedAt: sweepSnapshot.computedAt,
  });
}
