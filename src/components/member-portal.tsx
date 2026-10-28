"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VerifyEmailBanner from "@/components/verify-email-banner";
import {
  useDeleteAccount,
  useInitiatePayment,
  useLogout,
  type SessionMember,
} from "@/hooks/use-auth";
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

const DEFAULT_QUESTIONS = [
  "What time is the Saturday class?",
  "Can I bring a guest with me?",
  "Why is my card not working before six?",
  "What are the gym access hours?",
  "What is the current subscription price?",
  "How do I pause my membership?",
  "What training plans are available?",
  "Who is the trainer on duty today?",
];

const DAY_MS = 24 * 60 * 60 * 1000;

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [selectedTier, setSelectedTier] = useState<MemberTier | null>(null);
  const [balanceIsStale, setBalanceIsStale] = useState(false);
  const logout = useLogout();
  const deleteAccount = useDeleteAccount();
  const payment = useInitiatePayment();

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

  const selectedPlan =
    (selectedTier
      ? billing?.availablePlans.find((plan) => plan.tier === selectedTier)
      : null) ??
    billing?.plan ??
    billing?.availablePlans[0] ??
    null;
  const status = billing?.status;
  const isNewMember = status === "new";
  const statusLabel = status ? copy.dashboard.status[status] : null;
  const statusClass = status ? STATUS_CLASS[status] : "";
  const tierLabel = billing
    ? TIER_LABEL[billing.effectiveTier]
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

  const handleLogout = () => {
    setLogoutError("");
    logout.mutate(undefined, {
      onError: () => setLogoutError(copy.errors.signOutFailed),
    });
  };

  const handleDeleteAccount = (e: React.FormEvent) => {
    e.preventDefault();

    if (deleteAccount.isPending || deletePassword.length === 0) {
      return;
    }

    setDeleteError("");

    deleteAccount.mutate(deletePassword.trim(), {
      onError: (error) =>
        setDeleteError(error.message || copy.deletion.passwordWrong),
    });
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
    <section
      className={styles.dashboardCard}
      aria-labelledby="member-portal-title"
    >
      <div className={styles.memberHeader}>
        <div>
          <h2
            id="member-portal-title"
            className="text-title-large"
            style={{ margin: 0 }}
          >
            {member.name}
          </h2>
          <span
            className="text-body-small"
            style={{ color: "var(--color-on-surface-variant)" }}
          >
            {member.email}
          </span>
        </div>
        <div className={styles.memberHeaderActions}>
          <span className={`text-label-large ${styles.memberNumberBadge}`}>
            #{member.memberNumber}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            className={styles.outlineBtn}
          >
            {copy.dashboard.signOut}
          </button>
        </div>
      </div>

      {logoutError && (
        <span role="alert" className={`text-body-small ${styles.verifyError}`}>
          {logoutError}
        </span>
      )}

      {!member.emailVerified && <VerifyEmailBanner email={member.email} />}

      <div className={styles.dashboardColumns}>
        <div className={styles.dashboardColumn}>
          {billingError && (
            <div role="alert" className={styles.billingError}>
              {copy.errors.privateRecordsUnreachable}
            </div>
          )}

          {!billing && !billingError && (
            <div className={styles.statusLoading} role="status">
              {copy.dashboard.loading}
            </div>
          )}

          {billing && (
            <>
              <div className={styles.statusTiles}>
                <div className={styles.statusTile}>
                  <span className={styles.statusTileLabel}>
                    {copy.dashboard.effectiveTier}
                  </span>
                  <span className={styles.statusTileValue}>{tierLabel}</span>
                </div>

                <div className={styles.statusTile}>
                  <span className={styles.statusTileLabel}>
                    {copy.dashboard.expiry}
                  </span>
                  <span className={styles.statusTileValue}>{expiryLabel}</span>
                  {statusLabel && (
                    <span className={`${styles.statusBadge} ${statusClass}`}>
                      {statusLabel}
                    </span>
                  )}
                </div>

                <div className={styles.statusTile}>
                  <span className={styles.statusTileLabel}>
                    {copy.dashboard.attendance}
                  </span>
                  <span className={styles.statusTileValue}>
                    {attendanceLabel}
                  </span>
                </div>

                <div className={styles.statusTile}>
                  <span className={styles.statusTileLabel}>
                    {copy.dashboard.balance}
                  </span>
                  <span className={styles.statusTileValue}>
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
                  </span>
                </div>
              </div>

              <div
                className={styles.paymentCard}
                aria-labelledby="subscription-title"
              >
                <div className={styles.paymentHeader}>
                  <h3
                    id="subscription-title"
                    className={`text-title-medium ${styles.paymentTitle}`}
                  >
                    {copy.payments.subscriptionTitle}
                  </h3>
                  {statusLabel && (
                    <span className={`${styles.statusBadge} ${statusClass}`}>
                      {statusLabel}
                    </span>
                  )}
                </div>

                {billing.availablePlans.length > 0 && (
                  <div className={styles.planChooser}>
                    <span className={`text-label-medium ${styles.paymentRowLabel}`}>
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
                    <span className={styles.paymentRowValue}>
                      {planDetail}
                    </span>
                  </div>
                  <div className={styles.paymentRow}>
                    <span className={styles.paymentRowLabel}>
                      {copy.payments.expiresLabel}
                    </span>
                    <span className={styles.paymentRowValue}>
                      {expiryLabel}
                    </span>
                  </div>
                  <div className={styles.paymentRow}>
                    <span className={styles.paymentRowLabel}>
                      {amountLabel}
                    </span>
                    <span className={styles.paymentAmount}>
                      {planAmount}
                    </span>
                  </div>
                </div>

                {selectedPlan ? (
                  <div className={styles.paymentActions}>
                    <button
                      type="button"
                      onClick={handleSubscribe}
                      disabled={payment.isPending}
                      className={styles.payButton}
                    >
                      {payment.isPending
                        ? copy.payments.starting
                        : copy.payments.subscribe}
                    </button>
                    {paymentError && (
                      <p
                        id="payment-error"
                        role="alert"
                        className={`text-body-small ${styles.verifyError}`}
                      >
                        {paymentError}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className={`text-body-small ${styles.paymentNotice}`}>
                      {planDetail}
                    </p>
                    <div className={styles.paymentActions}>
                      <button
                        type="button"
                        disabled
                        className={styles.payButton}
                      >
                        {copy.payments.subscribe}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.dashboardColumn}>
          <div className={styles.questionsPanel}>
            <h3 className={`text-title-medium ${styles.questionsHeader}`}>
              {copy.dashboard.askTitle}
            </h3>
            <span
              className="text-body-small"
              style={{ color: "var(--color-on-surface-variant)" }}
            >
              {copy.dashboard.askSubtitle}
            </span>

            <div className={styles.questionsGrid}>
              {DEFAULT_QUESTIONS.map((question, index) => (
                <button
                  key={index}
                  type="button"
                  className={styles.questionButton}
                  onClick={() => setSelectedQuestion(question)}
                >
                  {question}
                </button>
              ))}
            </div>

            <p className={styles.srOnly} role="status">
              {selectedQuestion
                ? `${selectedQuestion} ${copy.refusals.records}`
                : ""}
            </p>

            {selectedQuestion && (
              <div className={styles.bannerNotice}>
                <span
                  className="text-label-medium"
                  style={{
                    fontWeight: 700,
                    color: "var(--color-on-surface)",
                  }}
                >
                  {selectedQuestion}
                </span>
                <span className="text-body-small">
                  {copy.refusals.records}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.dashboardFooter}>
        <span
          className="text-body-small"
          style={{ color: "var(--color-on-surface-variant)" }}
        >
          {copy.dashboard.assistance}
        </span>
        <Link href="/auth?view=reset" className={styles.linkReset}>
          {copy.dashboard.managePassword}
        </Link>
      </div>

      <div className={styles.deleteSection}>
        {deleteOpen ? (
          <form
            onSubmit={handleDeleteAccount}
            className={styles.deleteForm}
          >
            <span
              className="text-body-small"
              style={{ color: "var(--color-on-surface-variant)" }}
            >
              {copy.deletion.warning}
            </span>
            <div className={styles.deleteActions}>
              <div className={styles.verifyField}>
                <label
                  htmlFor="delete-account-password"
                  className={`text-label-small ${styles.verifyLabel}`}
                >
                  {copy.deletion.confirmPrompt}
                </label>
                <input
                  id="delete-account-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  aria-invalid={deleteError ? true : undefined}
                  aria-describedby={
                    deleteError ? "delete-account-error" : undefined
                  }
                  className={`text-body-medium ${styles.verifyInput}`}
                />
              </div>
              <button
                type="submit"
                disabled={
                  deleteAccount.isPending || deletePassword.length === 0
                }
                className={`text-label-medium ${styles.deleteConfirmButton}`}
              >
                {deleteAccount.isPending
                  ? copy.deletion.deleting
                  : copy.deletion.confirmButton}
              </button>
              <button
                type="button"
                disabled={deleteAccount.isPending}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletePassword("");
                  setDeleteError("");
                }}
                className={`text-label-medium ${styles.verifyResendButton}`}
              >
                {copy.deletion.cancelButton}
              </button>
            </div>
            {deleteError && (
              <span
                id="delete-account-error"
                role="alert"
                className={`text-body-small ${styles.verifyError}`}
              >
                {deleteError}
              </span>
            )}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className={`text-label-medium ${styles.deleteLink}`}
          >
            {copy.deletion.openButton}
          </button>
        )}
      </div>
    </section>
  );
}
