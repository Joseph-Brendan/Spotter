"use client";

import { useEffect, useRef, useState } from "react";
import CheckInCard from "@/components/checkin/check-in-card";
import VerifyEmailBanner from "@/components/verify-email-banner";
import { useInitiatePayment, type SessionMember } from "@/hooks/use-auth";
import { useChat, type ChatState } from "@/hooks/use-chat";
import {
  usePaymentConfirmation,
  type PaymentConfirmationState,
} from "@/hooks/use-payment-confirmation";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";
import { formatKobo } from "@/lib/money";
import type {
  MemberBillingSummary,
  MemberTier,
  MembershipStatus,
} from "@/types/member";
import styles from "@/app/page.module.css";

interface MemberPortalProps {
  member: SessionMember;
  billing: MemberBillingSummary | null;
  billingError: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const VISIBLE_QUESTIONS = 2;
const RETURN_PARAMS = new Set(["return", "confirmed"]);

const PAYMENT_MESSAGE: Record<
  Exclude<PaymentConfirmationState, "idle">,
  string
> = {
  confirming: copy.payments.confirming,
  confirmed: copy.payments.confirmed,
  failed: copy.payments.notCompleted,
  stillConfirming: copy.payments.stillConfirming,
};

function chatAnnouncement(state: ChatState, question: string | null): string {
  switch (state.status) {
    case "asking":
      return copy.chat.thinking;
    case "answered":
      return `${question ?? ""} ${state.reply}`.trim();
    case "refused":
      return `${question ?? ""} ${copy.refusals.records}`.trim();
    default:
      return "";
  }
}

// The member portal only mounts in the browser, after the session loads.
function readPaymentReturn(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const param = new URLSearchParams(window.location.search).get("payment");
  return param !== null && RETURN_PARAMS.has(param);
}

const STATUS_CLASS: Record<MembershipStatus, string> = {
  new: styles.statusNew,
  active: styles.statusActive,
  grace: styles.statusGrace,
  expired: styles.statusExpired,
  cancelled: styles.statusCancelled,
};

const TIER_LABEL: Record<MemberTier, string> = {
  BASIC: copy.dashboard.tierBasic,
  PREMIUM: copy.dashboard.tierPremium,
  DIAMOND: copy.dashboard.tierDiamond,
};

export default function MemberPortal({
  member,
  billing,
  billingError,
}: MemberPortalProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [ownQuestion, setOwnQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [selectedTier, setSelectedTier] = useState<MemberTier | null>(null);
  const [balanceIsStale, setBalanceIsStale] = useState(false);
  const planToggleRef = useRef<HTMLButtonElement>(null);
  const planHeadingRef = useRef<HTMLHeadingElement>(null);
  const wasPlanOpenRef = useRef(false);
  const payment = useInitiatePayment();
  const chat = useChat();
  const [returnedFromCheckout] = useState(readPaymentReturn);
  const paymentConfirmation = usePaymentConfirmation(returnedFromCheckout);

  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.has("payment")) {
      url.searchParams.delete("payment");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, []);

  useEffect(() => {
    if (!billing) {
      const clearTimer = setTimeout(() => setBalanceIsStale(false), 0);
      return () => clearTimeout(clearTimer);
    }

    const age = Date.now() - new Date(billing.fetchedAt).getTime();
    const checkTimer = setTimeout(
      () => setBalanceIsStale(age > DAY_MS),
      0
    );
    const staleTimer = setTimeout(
      () => setBalanceIsStale(true),
      Math.max(0, DAY_MS - age)
    );

    return () => {
      clearTimeout(checkTimer);
      clearTimeout(staleTimer);
    };
  }, [billing]);

  useEffect(() => {
    if (planOpen) {
      planHeadingRef.current?.focus();
    } else if (wasPlanOpenRef.current) {
      planToggleRef.current?.focus();
    }

    wasPlanOpenRef.current = planOpen;
  }, [planOpen]);

  const selectedPlan =
    (selectedTier
      ? billing?.availablePlans.find((plan) => plan.tier === selectedTier)
      : null) ??
    billing?.plan ??
    billing?.availablePlans[0] ??
    null;
  const status = billing?.status;
  const isNewMember = status === "new";
  const needsPlan = Boolean(status) && status !== "active";
  const statusLabel = status ? copy.dashboard.status[status] : null;
  const statusClass = status ? STATUS_CLASS[status] : "";
  const tierLabel = billing
    ? billing.storedTier
      ? TIER_LABEL[billing.effectiveTier]
      : copy.payments.notSet
    : null;
  const expiryLabel = billing?.expiryDate
    ? formatDate(billing.expiryDate, billing.gymTimezone)
    : copy.payments.notSet;
  const readingDate = billing
    ? formatDate(billing.fetchedAt, billing.gymTimezone)
    : "";
  const attendanceLabel = billing
    ? billing.daysTrainedThisMonth === 0
      ? copy.empty.zeroDaysThisMonth
      : copy.dashboard.daysTrained(billing.daysTrainedThisMonth)
    : null;
  const planDetail = selectedPlan
    ? `${TIER_LABEL[selectedPlan.tier]} · ${formatKobo(
        selectedPlan.priceKobo
      )} · ${copy.payments.everyDays(selectedPlan.durationDays)}`
    : isNewMember
      ? copy.payments.plansNotSet
      : copy.payments.planNotSet;
  const amountLabel = isNewMember
    ? copy.payments.priceLabel
    : copy.payments.renewalAmountLabel;
  const planAmount = selectedPlan
    ? formatKobo(selectedPlan.priceKobo)
    : copy.payments.notSet;

  const visibleQuestions = showAllQuestions
    ? copy.dashboard.suggestedQuestions
    : copy.dashboard.suggestedQuestions.slice(0, VISIBLE_QUESTIONS);
  const hasMoreQuestions =
    copy.dashboard.suggestedQuestions.length > VISIBLE_QUESTIONS;
  const announcedQuestion = askedQuestion ?? selectedQuestion;
  const askNeedsPlan = Boolean(billing) && !billing?.storedTier;
  const showAskNeedsPlan = askNeedsPlan && ownQuestion.length > 0;

  const selectQuestion = (question: string) => {
    setAskedQuestion(null);
    setSelectedQuestion((current) => (current === question ? null : question));
  };

  const toggleAllQuestions = () => {
    if (
      showAllQuestions &&
      copy.dashboard.suggestedQuestions
        .slice(VISIBLE_QUESTIONS)
        .some((question) => question === selectedQuestion)
    ) {
      setSelectedQuestion(null);
    }

    setShowAllQuestions((open) => !open);
  };

  const handleAskOwnQuestion = (e: React.FormEvent) => {
    e.preventDefault();

    const question = ownQuestion.trim();

    if (question.length === 0 || askNeedsPlan) {
      return;
    }

    if (chat.state.status === "asking") {
      return;
    }

    setSelectedQuestion(null);
    setAskedQuestion(question);
    setOwnQuestion("");
    void chat.ask(question);
  };

  const selectPlan = (tier: MemberTier) => {
    setSelectedTier(tier);
    setPaymentError("");
  };

  const handleSubscribe = () => {
    if (!selectedPlan || payment.isPending) {
      return;
    }

    const idempotencyKey = crypto.randomUUID();
    setPaymentError("");

    payment.mutate(
      {
        purpose: "RENEWAL",
        tier: selectedPlan.tier,
        idempotencyKey,
      },
      {
        onSuccess: (data) => {
          if (data.checkoutUrl) {
            window.location.assign(data.checkoutUrl);
            return;
          }

          setPaymentError(copy.payments.failedToStart);
        },
        onError: (error) => {
          setPaymentError(error.message || copy.payments.failedToStart);
        },
      }
    );
  };

  return (
    <div className={styles.memberDashboard}>
      <header className={styles.memberIntro}>
        <h1
          id="member-portal-title"
          className={`text-headline-small ${styles.memberName}`}
        >
          {member.name}
        </h1>
        <span className={`text-label-medium ${styles.memberNumberBadge}`}>
          #{member.memberNumber}
        </span>
      </header>

      {paymentConfirmation !== "idle" && (
        <div
          className={styles.paymentBanner}
          data-state={paymentConfirmation}
          role={paymentConfirmation === "failed" ? "alert" : "status"}
        >
          {paymentConfirmation === "confirming" && (
            <span className={styles.paymentBannerPulse} aria-hidden="true" />
          )}
          <span className="text-body-medium">
            {PAYMENT_MESSAGE[paymentConfirmation]}
          </span>
        </div>
      )}

      {!member.emailVerified && <VerifyEmailBanner email={member.email} />}

      {billing && (
        <CheckInCard
          status={billing.status}
          checkedInToday={billing.checkedInToday}
          attendanceLabel={attendanceLabel}
          onChoosePlan={() =>
            planOpen ? planHeadingRef.current?.focus() : setPlanOpen(true)
          }
        />
      )}

      <div className={styles.memberLayout}>
        <section className={styles.askPanel} aria-labelledby="ask-title">
          <div className={styles.askHeader}>
            <h2 id="ask-title" className={`text-title-medium ${styles.askTitle}`}>
              {copy.dashboard.askTitle}
            </h2>
          </div>

          <ul id="suggested-questions" className={styles.questionList}>
            {visibleQuestions.map((question) => {
              const isSelected = selectedQuestion === question;

              return (
                <li
                  key={question}
                  className={`${styles.questionItem}${
                    isSelected ? ` ${styles.questionItemSelected}` : ""
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className={styles.questionButton}
                    onClick={() => selectQuestion(question)}
                  >
                    <span>{question}</span>
                    <svg
                      className={styles.questionChevron}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>
                  {isSelected && (
                    <p className={`text-body-medium ${styles.answerBody}`}>
                      {copy.refusals.records}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {hasMoreQuestions && (
            <button
              type="button"
              className={styles.moreQuestionsToggle}
              aria-expanded={showAllQuestions}
              aria-controls="suggested-questions"
              onClick={toggleAllQuestions}
            >
              {showAllQuestions
                ? copy.dashboard.fewerQuestions
                : copy.dashboard.moreQuestions}
              <svg
                className={styles.moreQuestionsChevron}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}

          <form className={styles.ownQuestionForm} onSubmit={handleAskOwnQuestion}>
            <label
              htmlFor="own-question"
              className={`text-label-medium ${styles.ownQuestionLabel}`}
            >
              {copy.dashboard.ownQuestionLabel}
            </label>
            <div className={styles.ownQuestionRow}>
              <input
                id="own-question"
                type="text"
                autoComplete="off"
                enterKeyHint="send"
                maxLength={500}
                value={ownQuestion}
                onChange={(event) => setOwnQuestion(event.target.value)}
                aria-describedby={
                  showAskNeedsPlan ? "own-question-needs-plan" : undefined
                }
                className={`text-body-medium ${styles.ownQuestionInput}`}
              />
              <button
                type="submit"
                disabled={
                  ownQuestion.trim().length === 0 ||
                  askNeedsPlan ||
                  chat.state.status === "asking"
                }
                className={styles.ownQuestionSubmit}
              >
                {copy.dashboard.askButton}
              </button>
            </div>
            <p
              id="own-question-needs-plan"
              className={styles.ownQuestionNeedsPlan}
              aria-live="polite"
            >
              {showAskNeedsPlan ? copy.dashboard.askNeedsPlan : ""}
            </p>
          </form>

          {askedQuestion && (
            <div
              className={styles.ownAnswer}
              aria-busy={chat.state.status === "asking"}
            >
              <p className={`text-label-large ${styles.ownAnswerQuestion}`}>
                {askedQuestion}
              </p>

              {chat.state.status === "asking" && (
                <p className={`text-body-medium ${styles.ownAnswerBody}`}>
                  {copy.chat.thinking}
                </p>
              )}

              {chat.state.status === "answered" && (
                <>
                  <p
                    className={`text-body-medium ${styles.ownAnswerBody} ${styles.chatReply}`}
                  >
                    {chat.state.reply}
                  </p>
                  <p className={styles.prototypeNotice}>
                    {copy.chat.prototypeNotice}
                  </p>
                </>
              )}

              {chat.state.status === "refused" && (
                <p className={`text-body-medium ${styles.ownAnswerBody}`}>
                  {copy.refusals.records}
                </p>
              )}

              {chat.state.status === "error" && (
                <p
                  className={`text-body-medium ${styles.ownAnswerBody}`}
                  role="alert"
                >
                  {chat.state.message}
                </p>
              )}
            </div>
          )}

          <p className={styles.srOnly} role="status">
            {chatAnnouncement(chat.state, askedQuestion) ||
              (announcedQuestion
                ? `${announcedQuestion} ${copy.refusals.records}`
                : "")}
          </p>
        </section>

        <div className={styles.memberMain}>
          <section
            className={styles.statusCard}
            data-status={status}
            aria-labelledby="membership-status-title"
            aria-busy={!billing && !billingError}
          >
            {billingError && (
              <div role="alert" className={styles.billingError}>
                {copy.errors.privateRecordsUnreachable}
              </div>
            )}

            {!billing && !billingError && (
              <>
                <h2 id="membership-status-title" className={styles.srOnly}>
                  {copy.dashboard.effectiveTier}
                </h2>
                <p className={styles.statusLoading} role="status">
                  {copy.dashboard.loading}
                </p>
                <div className={styles.statusSkeleton} aria-hidden="true">
                  <span
                    className={`${styles.skeletonBlock} ${styles.skeletonTier}`}
                  />
                  <span
                    className={`${styles.skeletonBlock} ${styles.skeletonHero}`}
                  />
                  <div className={styles.skeletonRow}>
                    <span className={styles.skeletonBlock} />
                    <span className={styles.skeletonBlock} />
                  </div>
                </div>
              </>
            )}

            {billing && (
              <>
                <div className={styles.statusCardTop}>
                  <h2
                    id="membership-status-title"
                    className={styles.statusHeading}
                  >
                    <span className={styles.statLabel}>
                      {copy.dashboard.effectiveTier}
                    </span>
                    <span className={styles.statusTier}>{tierLabel}</span>
                  </h2>
                  {statusLabel && (
                    <span className={`${styles.statusBadge} ${statusClass}`}>
                      <span className={styles.statusDot} aria-hidden="true" />
                      {statusLabel}
                    </span>
                  )}
                </div>

                <dl className={styles.statGrid}>
                  <div className={styles.statHero}>
                    <dt className={styles.statLabel}>
                      {copy.dashboard.attendance}
                    </dt>
                    <dd className={styles.statHeroValue}>{attendanceLabel}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt className={styles.statLabel}>
                      {copy.dashboard.expiry}
                    </dt>
                    <dd className={styles.statValue}>{expiryLabel}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt className={styles.statLabel}>
                      {copy.dashboard.balance}
                    </dt>
                    <dd className={styles.statValue}>
                      {balanceIsStale ? (
                        copy.stale.openToRefresh
                      ) : billing.balanceKobo === 0 ? (
                        copy.payments.nothingDue
                      ) : (
                        <>
                          {formatKobo(billing.balanceKobo)}
                          <span className={styles.statusTileFraming}>
                            {copy.money.framing(readingDate)}
                          </span>
                        </>
                      )}
                    </dd>
                  </div>
                </dl>

                {!billing.storedTier && (
                  <p className={styles.noPlanNotice}>
                    {copy.payments.noPlanYet}
                  </p>
                )}

                <div
                  className={
                    needsPlan ? styles.statusActions : styles.statusActionsQuiet
                  }
                >
                  <button
                    ref={planToggleRef}
                    type="button"
                    className={needsPlan ? styles.primaryBtn : styles.planLink}
                    aria-expanded={planOpen}
                    aria-controls="plan-panel"
                    onClick={() => setPlanOpen((open) => !open)}
                  >
                    {copy.payments.choosePlan}
                    {!needsPlan && (
                      <svg
                        className={styles.planLinkChevron}
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    )}
                  </button>
                </div>
              </>
            )}
          </section>

          {billing && planOpen && (
            <section
              id="plan-panel"
              className={styles.paymentCard}
              aria-labelledby="subscription-title"
            >
              <h2
                id="subscription-title"
                ref={planHeadingRef}
                tabIndex={-1}
                className={`text-title-medium ${styles.paymentTitle}`}
              >
                {copy.payments.subscriptionTitle}
              </h2>

              {billing.availablePlans.length > 0 && (
                <div className={styles.planChooser}>
                  <span
                    className={`text-label-medium ${styles.paymentRowLabel}`}
                  >
                    {copy.payments.choosePlan}
                  </span>
                  <div
                    className={styles.planChoices}
                    role="radiogroup"
                    aria-label={copy.payments.choosePlan}
                  >
                    {billing.availablePlans.map((availablePlan) => {
                      const isSelected =
                        selectedPlan?.tier === availablePlan.tier;

                      return (
                        <button
                          key={availablePlan.tier}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => selectPlan(availablePlan.tier)}
                          className={`${styles.planChoice} ${
                            isSelected ? styles.planChoiceSelected : ""
                          }`}
                        >
                          <span className={styles.planChoiceName}>
                            {TIER_LABEL[availablePlan.tier]}
                          </span>
                          <span className={styles.planChoicePrice}>
                            {formatKobo(availablePlan.priceKobo)}
                          </span>
                          <span className={styles.planChoiceMeta}>
                            {copy.payments.everyDays(
                              availablePlan.durationDays
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={styles.paymentRows}>
                <div className={styles.paymentRow}>
                  <span className={styles.paymentRowLabel}>
                    {copy.payments.planLabel}
                  </span>
                  <span className={styles.paymentRowValue}>{planDetail}</span>
                </div>
                <div className={styles.paymentRow}>
                  <span className={styles.paymentRowLabel}>{amountLabel}</span>
                  <span className={styles.paymentAmount}>{planAmount}</span>
                </div>
              </div>

              {!selectedPlan && (
                <p className={`text-body-small ${styles.paymentNotice}`}>
                  {planDetail}
                </p>
              )}

              <div className={styles.paymentActions}>
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={!selectedPlan || payment.isPending}
                  aria-describedby={paymentError ? "payment-error" : undefined}
                  className={styles.payButton}
                >
                  {payment.isPending
                    ? copy.payments.starting
                    : copy.payments.subscribe}
                </button>
                <button
                  type="button"
                  onClick={() => setPlanOpen(false)}
                  disabled={payment.isPending}
                  className={styles.outlineBtn}
                >
                  {copy.payments.cancel}
                </button>
              </div>

              {paymentError && (
                <p
                  id="payment-error"
                  role="alert"
                  className={`text-body-small ${styles.verifyError}`}
                >
                  {paymentError}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
