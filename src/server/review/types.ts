export interface WrongAnswerReportItem {
  id: string;
  questionLogId: string;
  question: string;
  answerText: string | null;
  note: string | null;
  reportedAt: string;
  memberNumber: string;
  memberName: string;
}

export interface UnansweredQuestionItem {
  id: string;
  question: string;
  intent: string;
  outcome: string;
  topScore: number | null;
  askedAt: string;
  memberNumber: string;
  memberName: string;
}

export interface BlockedUngroundedItem {
  id: string;
  question: string;
  intent: string;
  outcome: string;
  topScore: number | null;
  cardId: string | null;
  cardTitle: string | null;
  askedAt: string;
  memberNumber: string;
  memberName: string;
}

export interface AbandonedPaymentItem {
  id: string;
  reference: string;
  amountKobo: number;
  currency: string;
  purpose: string;
  failureReason: string | null;
  createdAt: string;
  memberNumber: string;
  memberName: string;
}

export interface OverdueCardItem {
  id: string;
  title: string;
  category: string;
  minTier: string;
  reviewIntervalDays: number;
  lastConfirmedAt: string | null;
  updatedAt: string;
  daysOverdue: number;
}

export interface PrivacyExceptionItem {
  id: string;
  sessionMemberId: string;
  sessionMemberNumber: string | null;
  sessionMemberName: string | null;
  targetMemberId: string;
  targetMemberNumber: string | null;
  targetMemberName: string | null;
  functionName: string;
  createdAt: string;
}

export interface CheckInDailySpikeItem {
  date: string;
  dayOfWeek: string;
  dailyCheckIns: number;
  trailingFourWeekAvg: number;
  percentageOverAverage: number;
}

export interface CheckInWeeklyExcessItem {
  memberId: string;
  memberNumber: string;
  memberName: string;
  weekStartDate: string;
  weekEndDate: string;
  totalCheckIns: number;
  allowedDays: number;
}

export interface OwnerReviewSnapshotPayload {
  wrongAnswers: WrongAnswerReportItem[];
  unansweredQuestions: UnansweredQuestionItem[];
  blockedUngrounded: BlockedUngroundedItem[];
  abandonedPayments: AbandonedPaymentItem[];
  overdueCards: OverdueCardItem[];
  privacyExceptions: PrivacyExceptionItem[];
  checkInDailySpikes: CheckInDailySpikeItem[];
  checkInWeeklyExcess: CheckInWeeklyExcessItem[];
}

export interface OwnerReviewSnapshotSummary {
  id: string;
  gymId: string | null;
  computedAt: string;
  wrongAnswersCount: number;
  unansweredCount: number;
  blockedUngroundedCount: number;
  abandonedPaymentsCount: number;
  overdueCardsCount: number;
  privacyExceptionsCount: number;
  checkInSpikeDaysCount: number;
  excessiveMemberCheckInsCount: number;
  data: OwnerReviewSnapshotPayload;
}

export interface WeeklyAuditQuestionItem {
  id: string;
  question: string;
  answerText: string | null;
  cardTitle: string | null;
  memberNumber: string;
  askedAt: string;
  latestAudit: {
    id: string;
    verdict: "CORRECT" | "WRONG";
    auditedAt: string;
    auditorName: string;
  } | null;
}
