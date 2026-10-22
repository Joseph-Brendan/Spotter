import { describe, expect, it, vi } from "vitest";
import {
  getLatestOwnerReviewSnapshot,
  runOwnerReviewSweep,
} from "@/server/jobs/owner-review-sweep";
import { prisma } from "@/server/db";

describe("ownerReviewSweep", () => {
  it("pre-computes review summary counts and saves snapshot in database", async () => {
    // Mock prisma queries
    vi.spyOn(prisma.wrongAnswerReport, "findMany").mockResolvedValueOnce([
      {
        id: "rep-1",
        questionLogId: "q-1",
        note: "Wrong opening hour",
        createdAt: new Date(),
        questionLog: {
          question: "When do you open?",
          answerText: "7 AM",
          member: { id: "m-1", memberNumber: "1001", name: "Alice" },
        },
      },
    ] as any);

    vi.spyOn(prisma.questionLog, "findMany")
      // Unanswered
      .mockResolvedValueOnce([
        {
          id: "q-unanswered-1",
          question: "Can I bring my pet?",
          intent: "UNCLEAR",
          outcome: "UNCLEAR",
          topScore: null,
          askedAt: new Date(),
          member: { id: "m-1", memberNumber: "1001", name: "Alice" },
        },
      ] as any)
      // Blocked ungrounded
      .mockResolvedValueOnce([
        {
          id: "q-blocked-1",
          question: "Is there a sauna?",
          intent: "SHARED_QUESTION",
          outcome: "BLOCKED_UNGROUNDED",
          topScore: 0.42,
          cardId: "card-sauna",
          card: { id: "card-sauna", title: "Sauna Access" },
          askedAt: new Date(),
          member: { id: "m-1", memberNumber: "1001", name: "Alice" },
        },
      ] as any);

    vi.spyOn(prisma.paymentAttempt, "findMany").mockResolvedValueOnce([
      {
        id: "pay-1",
        reference: "ref-123",
        amountKobo: 2500000,
        currency: "NGN",
        purpose: "RENEWAL",
        failureReason: "abandoned_by_user",
        createdAt: new Date(),
        member: { id: "m-1", memberNumber: "1001", name: "Alice" },
      },
    ] as any);

    // Overdue cards
    vi.spyOn(prisma.card, "findMany").mockResolvedValueOnce([
      {
        id: "card-1",
        title: "Guest Policy",
        category: "GUEST_POLICY",
        minTier: "BASIC",
        reviewIntervalDays: 30,
        lastConfirmedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 15 days overdue
        updatedAt: new Date(),
      },
    ] as any);

    // Raw queries: checkin daily spikes, checkin weekly excess, privacy exceptions
    vi.spyOn(prisma, "$queryRaw")
      .mockResolvedValueOnce([]) // privacy
      .mockResolvedValueOnce([
        {
          date: "2026-10-20",
          dayOfWeek: "Tuesday",
          dailyCheckIns: 45,
          trailingFourWeekAvg: 20.0,
          percentageOverAverage: 225.0,
        },
      ]) // daily spikes
      .mockResolvedValueOnce([
        {
          weekStartDate: "2026-10-12",
          weekEndDate: "2026-10-18",
          memberId: "m-1",
          memberNumber: "1001",
          memberName: "Alice",
          totalCheckIns: 9,
          allowedDays: 7,
        },
      ]); // weekly excess

    const now = new Date();
    vi.spyOn(prisma.ownerReviewSnapshot, "create").mockResolvedValueOnce({
      id: "snap-123",
      gymId: "gym-1",
      computedAt: now,
      wrongAnswersCount: 1,
      unansweredCount: 1,
      blockedUngroundedCount: 1,
      abandonedPaymentsCount: 1,
      overdueCardsCount: 1,
      privacyExceptionsCount: 0,
      checkInSpikeDaysCount: 1,
      excessiveMemberCheckInsCount: 1,
      data: {} as any,
      createdAt: now,
    } as any);

    const summary = await runOwnerReviewSweep({ gymId: "gym-1" });

    expect(summary.id).toBe("snap-123");
    expect(summary.wrongAnswersCount).toBe(1);
    expect(summary.unansweredCount).toBe(1);
    expect(summary.blockedUngroundedCount).toBe(1);
    expect(summary.abandonedPaymentsCount).toBe(1);
    expect(summary.overdueCardsCount).toBe(1);
    expect(summary.checkInSpikeDaysCount).toBe(1);
    expect(summary.excessiveMemberCheckInsCount).toBe(1);
    expect(summary.data.checkInDailySpikes[0].dailyCheckIns).toBe(45);
    expect(summary.data.checkInWeeklyExcess[0].totalCheckIns).toBe(9);
  });

  it("retrieves latest pre-computed snapshot in O(1) without heavy aggregation", async () => {
    const mockDate = new Date();
    vi.spyOn(prisma.ownerReviewSnapshot, "findFirst").mockResolvedValueOnce({
      id: "snap-cached",
      gymId: "gym-1",
      computedAt: mockDate,
      wrongAnswersCount: 3,
      unansweredCount: 2,
      blockedUngroundedCount: 1,
      abandonedPaymentsCount: 4,
      overdueCardsCount: 0,
      privacyExceptionsCount: 0,
      checkInSpikeDaysCount: 0,
      excessiveMemberCheckInsCount: 0,
      data: {
        wrongAnswers: [],
        unansweredQuestions: [],
        blockedUngrounded: [],
        abandonedPayments: [],
        overdueCards: [],
        privacyExceptions: [],
        checkInDailySpikes: [],
        checkInWeeklyExcess: [],
      },
      createdAt: mockDate,
    } as any);

    const snapshot = await getLatestOwnerReviewSnapshot({ gymId: "gym-1" });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.id).toBe("snap-cached");
    expect(snapshot?.wrongAnswersCount).toBe(3);
  });
});
