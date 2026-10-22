import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type {
  AbandonedPaymentItem,
  BlockedUngroundedItem,
  CheckInDailySpikeItem,
  CheckInWeeklyExcessItem,
  OverdueCardItem,
  OwnerReviewSnapshotPayload,
  OwnerReviewSnapshotSummary,
  PrivacyExceptionItem,
  UnansweredQuestionItem,
  WrongAnswerReportItem,
} from "../review/types";

export interface SweepOptions {
  gymId?: string;
}

/**
 * Computes check-in daily spike anomalies using raw PostgreSQL window/CTE aggregations.
 * Flags days where total check-ins exceed 150% of the trailing 4-week average for that
 * specific day-of-the-week.
 */
async function queryCheckInDailySpikes(
  gymId?: string
): Promise<CheckInDailySpikeItem[]> {
  try {
    const gymCondition = gymId
      ? Prisma.sql`JOIN "Member" m ON c."memberId" = m.id WHERE m."gymId" = ${gymId}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{
        date: string;
        dayOfWeek: string;
        dailyCheckIns: number;
        trailingFourWeekAvg: number;
        percentageOverAverage: number;
      }>
    >`
      WITH daily_checkins AS (
        SELECT
          c."date"::date AS "date",
          COUNT(c.id)::int AS "count",
          TRIM(TO_CHAR(c."date", 'Day')) AS "dayOfWeek"
        FROM "CheckIn" c
        ${gymCondition}
        GROUP BY c."date"
      ),
      trailing_analysis AS (
        SELECT
          curr."date",
          curr."dayOfWeek",
          curr."count" AS "dailyCheckIns",
          COALESCE(AVG(prev."count"), 0)::float AS "trailingAvg",
          COUNT(prev."date")::int AS "sampleWeeks"
        FROM daily_checkins curr
        LEFT JOIN daily_checkins prev ON prev."date" IN (
          curr."date" - INTERVAL '7 days',
          curr."date" - INTERVAL '14 days',
          curr."date" - INTERVAL '21 days',
          curr."date" - INTERVAL '28 days'
        )
        GROUP BY curr."date", curr."dayOfWeek", curr."count"
      )
      SELECT
        "date"::text,
        "dayOfWeek",
        "dailyCheckIns",
        ROUND("trailingAvg"::numeric, 2)::float AS "trailingFourWeekAvg",
        ROUND((("dailyCheckIns"::numeric / NULLIF("trailingAvg"::numeric, 0)) * 100), 1)::float AS "percentageOverAverage"
      FROM trailing_analysis
      WHERE "sampleWeeks" >= 1 AND "trailingAvg" > 0 AND "dailyCheckIns" > (1.5 * "trailingAvg")
      ORDER BY "date" DESC
      LIMIT 100;
    `;

    return rows.map((r) => ({
      date: typeof r.date === "string" ? r.date.split("T")[0] : String(r.date),
      dayOfWeek: r.dayOfWeek,
      dailyCheckIns: Number(r.dailyCheckIns),
      trailingFourWeekAvg: Number(r.trailingFourWeekAvg),
      percentageOverAverage: Number(r.percentageOverAverage),
    }));
  } catch (error) {
    console.error("Failed to query check-in daily spikes via SQL:", error);
    return [];
  }
}

/**
 * Computes weekly check-in anomalies where a member's check-ins in a calendar week
 * exceed 7 (the number of days in that week).
 */
async function queryCheckInWeeklyExcess(
  gymId?: string
): Promise<CheckInWeeklyExcessItem[]> {
  try {
    const gymCondition = gymId
      ? Prisma.sql`WHERE m."gymId" = ${gymId}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{
        weekStartDate: string;
        weekEndDate: string;
        memberId: string;
        memberNumber: string;
        memberName: string;
        totalCheckIns: number;
        allowedDays: number;
      }>
    >`
      SELECT
        DATE_TRUNC('week', c."date")::date::text AS "weekStartDate",
        (DATE_TRUNC('week', c."date") + INTERVAL '6 days')::date::text AS "weekEndDate",
        m.id AS "memberId",
        m."memberNumber",
        m.name AS "memberName",
        COUNT(c.id)::int AS "totalCheckIns",
        7 AS "allowedDays"
      FROM "CheckIn" c
      JOIN "Member" m ON c."memberId" = m.id
      ${gymCondition}
      GROUP BY DATE_TRUNC('week', c."date"), m.id, m."memberNumber", m.name
      HAVING COUNT(c.id) > 7
      ORDER BY "weekStartDate" DESC, "totalCheckIns" DESC
      LIMIT 100;
    `;

    return rows.map((r) => ({
      weekStartDate:
        typeof r.weekStartDate === "string"
          ? r.weekStartDate.split("T")[0]
          : String(r.weekStartDate),
      weekEndDate:
        typeof r.weekEndDate === "string"
          ? r.weekEndDate.split("T")[0]
          : String(r.weekEndDate),
      memberId: r.memberId,
      memberNumber: r.memberNumber,
      memberName: r.memberName,
      totalCheckIns: Number(r.totalCheckIns),
      allowedDays: Number(r.allowedDays),
    }));
  } catch (error) {
    console.error("Failed to query check-in weekly excess via SQL:", error);
    return [];
  }
}

/**
 * Runs the nightly sweep job to aggregate system anomalies, reports, and review items.
 * Persists the resulting snapshot to `OwnerReviewSnapshot` so the Owner Review Page
 * loads instantly in O(1) time without running heavy aggregations on page open.
 */
export async function runOwnerReviewSweep(
  options: SweepOptions = {}
): Promise<OwnerReviewSnapshotSummary> {
  const { gymId } = options;
  const now = new Date();

  console.log(
    `[Nightly Sweep] Starting owner review sweep at ${now.toISOString()}...`
  );

  // 1. Wrong Answer Reports
  const rawWrongReports = await prisma.wrongAnswerReport.findMany({
    where: gymId
      ? {
          questionLog: {
            member: { gymId },
          },
        }
      : undefined,
    include: {
      questionLog: {
        include: {
          member: {
            select: { id: true, memberNumber: true, name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const wrongAnswers: WrongAnswerReportItem[] = rawWrongReports.map((r) => ({
    id: r.id,
    questionLogId: r.questionLogId,
    question: r.questionLog.question,
    answerText: r.questionLog.answerText,
    note: r.note,
    reportedAt: r.createdAt.toISOString(),
    memberNumber: r.questionLog.member.memberNumber,
    memberName: r.questionLog.member.name,
  }));

  // 2. Unanswered Questions (UNCLEAR, REFUSED_POLICY, REFUSED_NO_RECORD, ERROR)
  const rawUnanswered = await prisma.questionLog.findMany({
    where: {
      outcome: {
        in: ["UNCLEAR", "REFUSED_POLICY", "REFUSED_NO_RECORD", "ERROR"],
      },
      ...(gymId ? { member: { gymId } } : {}),
    },
    include: {
      member: {
        select: { id: true, memberNumber: true, name: true },
      },
    },
    orderBy: { askedAt: "desc" },
    take: 200,
  });

  const unansweredQuestions: UnansweredQuestionItem[] = rawUnanswered.map(
    (q) => ({
      id: q.id,
      question: q.question,
      intent: q.intent,
      outcome: q.outcome,
      topScore: q.topScore,
      askedAt: q.askedAt.toISOString(),
      memberNumber: q.member.memberNumber,
      memberName: q.member.name,
    })
  );

  // 3. Blocked Ungrounded Answers
  const rawBlocked = await prisma.questionLog.findMany({
    where: {
      outcome: "BLOCKED_UNGROUNDED",
      ...(gymId ? { member: { gymId } } : {}),
    },
    include: {
      card: { select: { id: true, title: true } },
      member: { select: { id: true, memberNumber: true, name: true } },
    },
    orderBy: { askedAt: "desc" },
    take: 200,
  });

  const blockedUngrounded: BlockedUngroundedItem[] = rawBlocked.map((q) => ({
    id: q.id,
    question: q.question,
    intent: q.intent,
    outcome: q.outcome,
    topScore: q.topScore,
    cardId: q.cardId,
    cardTitle: q.card?.title ?? null,
    askedAt: q.askedAt.toISOString(),
    memberNumber: q.member.memberNumber,
    memberName: q.member.name,
  }));

  // 4. Abandoned Payment Attempts
  const rawAbandonedPayments = await prisma.paymentAttempt.findMany({
    where: {
      status: "ABANDONED",
      ...(gymId ? { member: { gymId } } : {}),
    },
    include: {
      member: { select: { id: true, memberNumber: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const abandonedPayments: AbandonedPaymentItem[] = rawAbandonedPayments.map(
    (p) => ({
      id: p.id,
      reference: p.reference,
      amountKobo: p.amountKobo,
      currency: p.currency,
      purpose: p.purpose,
      failureReason: p.failureReason,
      createdAt: p.createdAt.toISOString(),
      memberNumber: p.member.memberNumber,
      memberName: p.member.name,
    })
  );

  // 5. Cards Past Review Interval
  const rawCards = await prisma.card.findMany({
    where: {
      status: "APPROVED",
      ...(gymId ? { gymId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const overdueCards: OverdueCardItem[] = [];
  const nowMs = now.getTime();

  for (const card of rawCards) {
    const referenceDate = card.lastConfirmedAt ?? card.updatedAt;
    const intervalMs = card.reviewIntervalDays * 24 * 60 * 60 * 1000;
    const dueDateMs = referenceDate.getTime() + intervalMs;

    if (nowMs > dueDateMs) {
      const daysOverdue = Math.floor(
        (nowMs - dueDateMs) / (24 * 60 * 60 * 1000)
      );
      overdueCards.push({
        id: card.id,
        title: card.title,
        category: card.category,
        minTier: card.minTier,
        reviewIntervalDays: card.reviewIntervalDays,
        lastConfirmedAt: card.lastConfirmedAt?.toISOString() ?? null,
        updatedAt: card.updatedAt.toISOString(),
        daysOverdue,
      });
    }
  }

  overdueCards.sort((a, b) => b.daysOverdue - a.daysOverdue);

  // 6. Privacy Exceptions: PrivateAccessLog where sessionMemberId != targetMemberId
  let privacyExceptions: PrivacyExceptionItem[] = [];
  try {
    const privacyRows = await prisma.$queryRaw<
      Array<{
        id: string;
        sessionMemberId: string;
        sessionMemberNumber: string | null;
        sessionMemberName: string | null;
        targetMemberId: string;
        targetMemberNumber: string | null;
        targetMemberName: string | null;
        functionName: string;
        createdAt: Date;
      }>
    >`
      SELECT
        p.id,
        p."sessionMemberId",
        sm."memberNumber" AS "sessionMemberNumber",
        sm.name AS "sessionMemberName",
        p."targetMemberId",
        tm."memberNumber" AS "targetMemberNumber",
        tm.name AS "targetMemberName",
        p."functionName",
        p."createdAt"
      FROM "PrivateAccessLog" p
      LEFT JOIN "Member" sm ON p."sessionMemberId" = sm.id
      LEFT JOIN "Member" tm ON p."targetMemberId" = tm.id
      WHERE p."sessionMemberId" != p."targetMemberId"
      ORDER BY p."createdAt" DESC
      LIMIT 200;
    `;

    privacyExceptions = privacyRows.map((r) => ({
      id: r.id,
      sessionMemberId: r.sessionMemberId,
      sessionMemberNumber: r.sessionMemberNumber,
      sessionMemberName: r.sessionMemberName,
      targetMemberId: r.targetMemberId,
      targetMemberNumber: r.targetMemberNumber,
      targetMemberName: r.targetMemberName,
      functionName: r.functionName,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
    }));
  } catch (error) {
    console.error("Failed to query privacy exceptions:", error);
  }

  // 7. Check-in Anomalies: Daily Spikes & Member Weekly Excess
  const checkInDailySpikes = await queryCheckInDailySpikes(gymId);
  const checkInWeeklyExcess = await queryCheckInWeeklyExcess(gymId);

  const payload: OwnerReviewSnapshotPayload = {
    wrongAnswers,
    unansweredQuestions,
    blockedUngrounded,
    abandonedPayments,
    overdueCards,
    privacyExceptions,
    checkInDailySpikes,
    checkInWeeklyExcess,
  };

  // 8. Persist the pre-computed snapshot in database
  const created = await prisma.ownerReviewSnapshot.create({
    data: {
      gymId: gymId ?? null,
      computedAt: now,
      wrongAnswersCount: wrongAnswers.length,
      unansweredCount: unansweredQuestions.length,
      blockedUngroundedCount: blockedUngrounded.length,
      abandonedPaymentsCount: abandonedPayments.length,
      overdueCardsCount: overdueCards.length,
      privacyExceptionsCount: privacyExceptions.length,
      checkInSpikeDaysCount: checkInDailySpikes.length,
      excessiveMemberCheckInsCount: checkInWeeklyExcess.length,
      data: payload as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(
    `[Nightly Sweep] Finished owner review sweep. Snapshot ID: ${created.id}. ` +
      `Summary: wrongAnswers=${wrongAnswers.length}, unanswered=${unansweredQuestions.length}, ` +
      `blockedUngrounded=${blockedUngrounded.length}, abandonedPayments=${abandonedPayments.length}, ` +
      `overdueCards=${overdueCards.length}, privacyExceptions=${privacyExceptions.length}, ` +
      `dailySpikes=${checkInDailySpikes.length}, weeklyExcess=${checkInWeeklyExcess.length}`
  );

  return {
    id: created.id,
    gymId: created.gymId,
    computedAt: created.computedAt.toISOString(),
    wrongAnswersCount: created.wrongAnswersCount,
    unansweredCount: created.unansweredCount,
    blockedUngroundedCount: created.blockedUngroundedCount,
    abandonedPaymentsCount: created.abandonedPaymentsCount,
    overdueCardsCount: created.overdueCardsCount,
    privacyExceptionsCount: created.privacyExceptionsCount,
    checkInSpikeDaysCount: created.checkInSpikeDaysCount,
    excessiveMemberCheckInsCount: created.excessiveMemberCheckInsCount,
    data: payload,
  };
}

/**
 * Retrieves the most recent pre-computed owner review snapshot.
 * Ensures instant page loads without computing aggregate queries on-the-fly.
 */
export async function getLatestOwnerReviewSnapshot(
  options: SweepOptions = {}
): Promise<OwnerReviewSnapshotSummary | null> {
  const { gymId } = options;

  const snapshot = await prisma.ownerReviewSnapshot.findFirst({
    where: gymId ? { gymId } : undefined,
    orderBy: { computedAt: "desc" },
  });

  if (!snapshot) {
    return null;
  }

  return {
    id: snapshot.id,
    gymId: snapshot.gymId,
    computedAt: snapshot.computedAt.toISOString(),
    wrongAnswersCount: snapshot.wrongAnswersCount,
    unansweredCount: snapshot.unansweredCount,
    blockedUngroundedCount: snapshot.blockedUngroundedCount,
    abandonedPaymentsCount: snapshot.abandonedPaymentsCount,
    overdueCardsCount: snapshot.overdueCardsCount,
    privacyExceptionsCount: snapshot.privacyExceptionsCount,
    checkInSpikeDaysCount: snapshot.checkInSpikeDaysCount,
    excessiveMemberCheckInsCount: snapshot.excessiveMemberCheckInsCount,
    data: snapshot.data as unknown as OwnerReviewSnapshotPayload,
  };
}
