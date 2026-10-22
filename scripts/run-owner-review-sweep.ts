/**
 * Standalone runner for the Owner Review Nightly Sweep.
 * Can be run via:
 *   npx tsx scripts/run-owner-review-sweep.ts
 * Or scheduled via cron:
 *   0 2 * * * cd /path/to/spotter && npx tsx scripts/run-owner-review-sweep.ts
 */
import { runOwnerReviewSweep } from "../src/server/jobs/owner-review-sweep";

async function main() {
  console.log("==================================================");
  console.log("SPOTTER: Initiating Nightly Owner Review Sweep");
  console.log("Timestamp:", new Date().toISOString());
  console.log("==================================================");

  try {
    const summary = await runOwnerReviewSweep();

    console.log("Sweep completed successfully!");
    console.log("Snapshot ID:", summary.id);
    console.log("Computed at:", summary.computedAt);
    console.log("--------------------------------------------------");
    console.log("Wrong answer reports:", summary.wrongAnswersCount);
    console.log("Unanswered questions:", summary.unansweredCount);
    console.log("Blocked ungrounded:", summary.blockedUngroundedCount);
    console.log("Abandoned payments:", summary.abandonedPaymentsCount);
    console.log("Overdue review cards:", summary.overdueCardsCount);
    console.log("Privacy exceptions:", summary.privacyExceptionsCount);
    console.log("Check-in daily spike days (>150%):", summary.checkInSpikeDaysCount);
    console.log("Check-in member weekly excess (>7):", summary.excessiveMemberCheckInsCount);
    console.log("==================================================");

    process.exit(0);
  } catch (error) {
    console.error("FATAL: Nightly sweep failed:", error);
    process.exit(1);
  }
}

void main();
