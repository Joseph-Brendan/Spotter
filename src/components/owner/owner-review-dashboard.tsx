"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "@/app/owner/owner-review.module.css";
import type {
  OwnerReviewSnapshotSummary,
  WeeklyAuditQuestionItem,
} from "@/server/review/types";

interface OwnerReviewDashboardProps {
  initialSnapshot: OwnerReviewSnapshotSummary;
  initialAuditSample: WeeklyAuditQuestionItem[];
  simulationMode: boolean;
  staff: {
    id: string;
    name: string;
    role: string;
    gymId: string;
  };
}

type TabKey =
  | "wrong-answers"
  | "unanswered"
  | "blocked-ungrounded"
  | "abandoned-payments"
  | "overdue-cards"
  | "privacy-exceptions"
  | "checkin-anomalies";

export default function OwnerReviewDashboard({
  initialSnapshot,
  initialAuditSample,
  simulationMode,
  staff,
}: OwnerReviewDashboardProps) {
  const [snapshot, setSnapshot] =
    useState<OwnerReviewSnapshotSummary>(initialSnapshot);
  const [auditSample, setAuditSample] =
    useState<WeeklyAuditQuestionItem[]>(initialAuditSample);
  const [activeTab, setActiveTab] = useState<TabKey>("wrong-answers");
  const [checkInSubTab, setCheckInSubTab] = useState<"spikes" | "excess">(
    "spikes"
  );
  const [isSweeping, setIsSweeping] = useState(false);
  const [isShufflingSample, setIsShufflingSample] = useState(false);
  const [submittingAuditId, setSubmittingAuditId] = useState<string | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculate audit progress (out of 20)
  const auditedCount = auditSample.filter((q) => q.latestAudit !== null).length;
  const auditProgressPercent =
    auditSample.length > 0 ? (auditedCount / auditSample.length) * 100 : 0;

  // Handle on-demand sweep trigger
  async function handleRunSweep() {
    setIsSweeping(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/owner/review/sweep", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to trigger review sweep.");
      }
      setSnapshot(data.snapshot);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Sweep failed unexpectedly."
      );
    } finally {
      setIsSweeping(false);
    }
  }

  // Handle refreshing / shuffling 20 audit sample questions
  async function handleShuffleSample() {
    setIsShufflingSample(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/owner/review/audit", {
        method: "GET",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch new audit sample.");
      }
      setAuditSample(data.sample);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to refresh sample."
      );
    } finally {
      setIsShufflingSample(false);
    }
  }

  // Handle marking question audit verdict (CORRECT or WRONG)
  async function handleAuditDecision(
    questionLogId: string,
    verdict: "CORRECT" | "WRONG"
  ) {
    setSubmittingAuditId(questionLogId);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/owner/review/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionLogId, verdict }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record audit verdict.");
      }

      // Update question log in local state with audit result
      setAuditSample((prev) =>
        prev.map((item) =>
          item.id === questionLogId
            ? {
                ...item,
                latestAudit: {
                  id: data.auditId,
                  verdict,
                  auditedAt: data.auditedAt,
                  auditorName: data.auditorName ?? staff.name,
                },
              }
            : item
        )
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to record audit."
      );
    } finally {
      setSubmittingAuditId(null);
    }
  }

  const { data } = snapshot;

  return (
    <main className={styles.page}>
      {/* 1. SIMULATION BANNER */}
      {simulationMode && (
        <section
          className={styles.simulationBanner}
          role="region"
          aria-label="Simulation Mode Warning"
        >
          <div className={styles.simulationContent}>
            <span className={styles.simulationIcon} aria-hidden="true">
              ⚠️
            </span>
            <div className={styles.simulationText}>
              <span className={styles.simulationTitle}>
                Check-in verification is being simulated (CHECKIN_SIMULATED=true)
              </span>
              <span className={styles.simulationDescription}>
                Generated six-digit member check-in codes will be automatically
                marked consumed 10 seconds after creation for testing purposes.
                Turnstiles and gate hardware are bypassed.
              </span>
            </div>
          </div>
          <span className={styles.simulationBadge}>Simulation Active</span>
        </section>
      )}

      {/* HEADER / NAVIGATION */}
      <header className={styles.topBar}>
        <div className={styles.brandGroup}>
          <Link href="/" className={`${styles.brand} text-label-large`}>
            SPOTTER
          </Link>
          <span className={styles.roleBadge}>Owner Review Center</span>
        </div>

        <div className={styles.headerActions}>
          <span className={`text-body-small ${styles.snapshotMeta}`}>
            <span className={styles.liveIndicator} aria-hidden="true" />
            Snapshot: {new Date(snapshot.computedAt).toLocaleString()}
          </span>

          <button
            type="button"
            onClick={handleRunSweep}
            disabled={isSweeping}
            className={styles.sweepButton}
            title="Execute background queries to refresh review counts and anomalies"
          >
            {isSweeping ? "Running Sweep..." : "Run Sweep Now"}
          </button>

          <Link href="/staff" className={styles.navLink}>
            Reception Desk
          </Link>
        </div>
      </header>

      <div className={styles.container}>
        {/* TITLE & AUDITOR INFO */}
        <div className={styles.pageHeader}>
          <div className={styles.titleArea}>
            <h1 className={`text-headline-medium ${styles.title}`}>
              Administrative Quality & Operational Review
            </h1>
            <p className={`text-body-medium ${styles.subtitle}`}>
              Pre-computed operational anomalies, wrong answer reports, privacy
              exceptions, and answer quality audits for gym administrators.
            </p>
          </div>

          <div className={`text-body-small ${styles.snapshotMeta}`}>
            <span>Auditor ID: {staff.id} ({staff.name})</span>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--color-error-container)",
              color: "var(--color-on-error-container)",
              border: "1px solid var(--color-error)",
              borderRadius: "6px",
              fontSize: "13px",
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* 2. WEEKLY ANSWER AUDIT SECTION */}
        <section
          className={styles.auditSection}
          aria-labelledby="weekly-audit-heading"
        >
          <div className={styles.auditHeader}>
            <div className={styles.auditTitleGroup}>
              <h2 id="weekly-audit-heading" className={styles.auditSectionTitle}>
                Weekly Answer Audit
              </h2>
              <span className={styles.badgeTag}>Sample size: 20 Questions</span>
            </div>

            <div className={styles.auditControls}>
              <div className={styles.auditProgressWrap}>
                <div className={styles.auditProgressText}>
                  <span>Audit Progress</span>
                  <span>
                    {auditedCount} of {auditSample.length}
                  </span>
                </div>
                <div className={styles.progressBarTrack}>
                  <div
                    className={styles.progressBarFill}
                    style={{ width: `${auditProgressPercent}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleShuffleSample}
                disabled={isShufflingSample}
                className={styles.shuffleButton}
                title="Pull a fresh random sample of 20 answered questions"
              >
                {isShufflingSample ? "Pulling..." : "Shuffle Sample (20)"}
              </button>
            </div>
          </div>

          <p className={styles.auditSubtitle}>
            Evaluate whether AI-generated answers accurately reflect official
            gym cards. Audit decisions record your user ID and timestamp
            permanently into the system log.
          </p>

          <div className={styles.auditGrid} style={{ marginTop: "16px" }}>
            {auditSample.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📋</span>
                <p>No answered questions found to audit in this sample.</p>
              </div>
            ) : (
              auditSample.map((q, idx) => {
                const isAudited = q.latestAudit !== null;
                const isSubmitting = submittingAuditId === q.id;

                return (
                  <div key={q.id} className={styles.auditCard}>
                    <div>
                      <div className={styles.auditCardHeader}>
                        <span className={styles.auditMemberBadge}>
                          #{q.memberNumber}
                        </span>
                        <span>
                          {new Date(q.askedAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div
                        className={styles.auditQuestionBlock}
                        style={{ marginTop: "10px" }}
                      >
                        <p className={styles.auditQuestionText}>
                          &ldquo;{q.question}&rdquo;
                        </p>
                        <div className={styles.auditAnswerBox}>
                          {q.answerText || <em>(Empty answer recorded)</em>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className={styles.auditCardMeta}>
                        <span>
                          Source Card: <strong>{q.cardTitle || "General Knowledge"}</strong>
                        </span>
                        <span>Item #{idx + 1}</span>
                      </div>

                      <div className={styles.auditActions}>
                        <div>
                          {isAudited ? (
                            <span
                              className={`${styles.auditVerdictBadge} ${
                                q.latestAudit?.verdict === "CORRECT"
                                  ? styles.verdictCorrect
                                  : styles.verdictWrong
                              }`}
                            >
                              ✓ {q.latestAudit?.verdict} ({q.latestAudit?.auditorName})
                            </span>
                          ) : (
                            <span
                              className={`${styles.auditVerdictBadge} ${styles.verdictPending}`}
                            >
                              Pending Audit
                            </span>
                          )}
                        </div>

                        <div className={styles.auditButtonRow}>
                          <button
                            type="button"
                            onClick={() => handleAuditDecision(q.id, "CORRECT")}
                            disabled={isSubmitting}
                            className={styles.btnCorrect}
                            aria-label={`Mark question ${idx + 1} as Correct`}
                          >
                            Correct
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAuditDecision(q.id, "WRONG")}
                            disabled={isSubmitting}
                            className={styles.btnWrong}
                            aria-label={`Mark question ${idx + 1} as Wrong`}
                          >
                            Wrong
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 3. METRIC CARDS OVERVIEW GRID */}
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className={`text-title-large ${styles.sectionTitle}`} style={{ marginBottom: "16px" }}>
            Operational Anomaly & Failure Summary
          </h2>

          <div className={styles.metricsGrid}>
            {/* Wrong Answers */}
            <button
              type="button"
              className={`${styles.metricCard} ${
                activeTab === "wrong-answers" ? styles.metricCardActive : ""
              }`}
              onClick={() => setActiveTab("wrong-answers")}
            >
              <div className={styles.metricCardTop}>
                <span className={styles.metricTitle}>Wrong Answers</span>
                <span
                  className={`${styles.metricBadge} ${
                    snapshot.wrongAnswersCount > 0
                      ? styles.metricBadgeAlert
                      : styles.metricBadgeNeutral
                  }`}
                >
                  Reports
                </span>
              </div>
              <div className={styles.metricValue}>
                {snapshot.wrongAnswersCount}
              </div>
              <div className={styles.metricDesc}>
                Member-reported inaccurate answers requiring owner correction.
              </div>
            </button>

            {/* Unanswered Questions */}
            <button
              type="button"
              className={`${styles.metricCard} ${
                activeTab === "unanswered" ? styles.metricCardActive : ""
              }`}
              onClick={() => setActiveTab("unanswered")}
            >
              <div className={styles.metricCardTop}>
                <span className={styles.metricTitle}>Unanswered</span>
                <span className={`${styles.metricBadge} ${styles.metricBadgeNeutral}`}>
                  Unclear / Refused
                </span>
              </div>
              <div className={styles.metricValue}>
                {snapshot.unansweredCount}
              </div>
              <div className={styles.metricDesc}>
                Questions where the system could not answer or refused.
              </div>
            </button>

            {/* Blocked Ungrounded */}
            <button
              type="button"
              className={`${styles.metricCard} ${
                activeTab === "blocked-ungrounded"
                  ? styles.metricCardActive
                  : ""
              }`}
              onClick={() => setActiveTab("blocked-ungrounded")}
            >
              <div className={styles.metricCardTop}>
                <span className={styles.metricTitle}>Blocked Ungrounded</span>
                <span
                  className={`${styles.metricBadge} ${
                    snapshot.blockedUngroundedCount > 0
                      ? styles.metricBadgeWarning
                      : styles.metricBadgeNeutral
                  }`}
                >
                  Hallucination Filter
                </span>
              </div>
              <div className={styles.metricValue}>
                {snapshot.blockedUngroundedCount}
              </div>
              <div className={styles.metricDesc}>
                Answers suppressed because similarity score was below threshold.
              </div>
            </button>

            {/* Abandoned Payments */}
            <button
              type="button"
              className={`${styles.metricCard} ${
                activeTab === "abandoned-payments"
                  ? styles.metricCardActive
                  : ""
              }`}
              onClick={() => setActiveTab("abandoned-payments")}
            >
              <div className={styles.metricCardTop}>
                <span className={styles.metricTitle}>Abandoned Payments</span>
                <span className={`${styles.metricBadge} ${styles.metricBadgeNeutral}`}>
                  Gateway
                </span>
              </div>
              <div className={styles.metricValue}>
                {snapshot.abandonedPaymentsCount}
              </div>
              <div className={styles.metricDesc}>
                Payment attempts started but never completed at gateway.
              </div>
            </button>

            {/* Overdue Review Cards */}
            <button
              type="button"
              className={`${styles.metricCard} ${
                activeTab === "overdue-cards" ? styles.metricCardActive : ""
              }`}
              onClick={() => setActiveTab("overdue-cards")}
            >
              <div className={styles.metricCardTop}>
                <span className={styles.metricTitle}>Overdue Cards</span>
                <span
                  className={`${styles.metricBadge} ${
                    snapshot.overdueCardsCount > 0
                      ? styles.metricBadgeWarning
                      : styles.metricBadgeNeutral
                  }`}
                >
                  Knowledge Base
                </span>
              </div>
              <div className={styles.metricValue}>
                {snapshot.overdueCardsCount}
              </div>
              <div className={styles.metricDesc}>
                Approved gym knowledge cards past their required review interval.
              </div>
            </button>

            {/* Privacy Exceptions */}
            <button
              type="button"
              className={`${styles.metricCard} ${
                activeTab === "privacy-exceptions"
                  ? styles.metricCardActive
                  : ""
              }`}
              onClick={() => setActiveTab("privacy-exceptions")}
            >
              <div className={styles.metricCardTop}>
                <span className={styles.metricTitle}>Privacy Exceptions</span>
                <span
                  className={`${styles.metricBadge} ${
                    snapshot.privacyExceptionsCount > 0
                      ? styles.metricBadgeAlert
                      : styles.metricBadgeNeutral
                  }`}
                >
                  Access Breach
                </span>
              </div>
              <div className={styles.metricValue}>
                {snapshot.privacyExceptionsCount}
              </div>
              <div className={styles.metricDesc}>
                Private access log rows where session caller != target member ID.
              </div>
            </button>

            {/* Check-In Anomalies */}
            <button
              type="button"
              className={`${styles.metricCard} ${
                activeTab === "checkin-anomalies"
                  ? styles.metricCardActive
                  : ""
              }`}
              onClick={() => setActiveTab("checkin-anomalies")}
            >
              <div className={styles.metricCardTop}>
                <span className={styles.metricTitle}>Check-in Anomalies</span>
                <span
                  className={`${styles.metricBadge} ${
                    snapshot.checkInSpikeDaysCount > 0 ||
                    snapshot.excessiveMemberCheckInsCount > 0
                      ? styles.metricBadgeAlert
                      : styles.metricBadgeNeutral
                  }`}
                >
                  Spikes & Excess
                </span>
              </div>
              <div className={styles.metricValue}>
                {snapshot.checkInSpikeDaysCount +
                  snapshot.excessiveMemberCheckInsCount}
              </div>
              <div className={styles.metricDesc}>
                Days exceeding 150% 4-week average or members &gt; 7 check-ins/week.
              </div>
            </button>
          </div>
        </section>

        {/* 4. EXPANDABLE REVIEW TABLES / DETAILED LISTINGS */}
        <section className={styles.tableSection}>
          <div className={styles.tableSectionHeader}>
            <div className={styles.tabRow} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "wrong-answers"}
                onClick={() => setActiveTab("wrong-answers")}
                className={`${styles.tabButton} ${
                  activeTab === "wrong-answers" ? styles.tabButtonActive : ""
                }`}
              >
                Wrong Answer Reports
                <span className={styles.tabPill}>
                  {snapshot.wrongAnswersCount}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "unanswered"}
                onClick={() => setActiveTab("unanswered")}
                className={`${styles.tabButton} ${
                  activeTab === "unanswered" ? styles.tabButtonActive : ""
                }`}
              >
                Unanswered Questions
                <span className={styles.tabPill}>
                  {snapshot.unansweredCount}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "blocked-ungrounded"}
                onClick={() => setActiveTab("blocked-ungrounded")}
                className={`${styles.tabButton} ${
                  activeTab === "blocked-ungrounded"
                    ? styles.tabButtonActive
                    : ""
                }`}
              >
                Blocked Ungrounded
                <span className={styles.tabPill}>
                  {snapshot.blockedUngroundedCount}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "abandoned-payments"}
                onClick={() => setActiveTab("abandoned-payments")}
                className={`${styles.tabButton} ${
                  activeTab === "abandoned-payments"
                    ? styles.tabButtonActive
                    : ""
                }`}
              >
                Abandoned Payments
                <span className={styles.tabPill}>
                  {snapshot.abandonedPaymentsCount}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "overdue-cards"}
                onClick={() => setActiveTab("overdue-cards")}
                className={`${styles.tabButton} ${
                  activeTab === "overdue-cards" ? styles.tabButtonActive : ""
                }`}
              >
                Overdue Review Cards
                <span className={styles.tabPill}>
                  {snapshot.overdueCardsCount}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "privacy-exceptions"}
                onClick={() => setActiveTab("privacy-exceptions")}
                className={`${styles.tabButton} ${
                  activeTab === "privacy-exceptions"
                    ? styles.tabButtonActive
                    : ""
                }`}
              >
                Privacy Exceptions
                <span className={styles.tabPill}>
                  {snapshot.privacyExceptionsCount}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "checkin-anomalies"}
                onClick={() => setActiveTab("checkin-anomalies")}
                className={`${styles.tabButton} ${
                  activeTab === "checkin-anomalies"
                    ? styles.tabButtonActive
                    : ""
                }`}
              >
                Check-in Anomalies
                <span className={styles.tabPill}>
                  {snapshot.checkInSpikeDaysCount +
                    snapshot.excessiveMemberCheckInsCount}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: WRONG ANSWER REPORTS */}
          {activeTab === "wrong-answers" && (
            <div className={styles.tableWrapper}>
              {data.wrongAnswers.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🎉</span>
                  <p>No wrong answer reports recorded.</p>
                </div>
              ) : (
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Reported At</th>
                      <th>Member</th>
                      <th>Question</th>
                      <th>System Answer</th>
                      <th>Member Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.wrongAnswers.map((item) => (
                      <tr key={item.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(item.reportedAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          <strong>{item.memberName}</strong>
                          <div style={{ fontSize: "11px", color: "var(--color-on-surface-variant)" }}>
                            #{item.memberNumber}
                          </div>
                        </td>
                        <td style={{ maxWidth: "260px" }}>{item.question}</td>
                        <td style={{ maxWidth: "320px", color: "var(--color-on-surface-variant)" }}>
                          {item.answerText || "(No answer text)"}
                        </td>
                        <td>
                          <span className={styles.badgeTagDanger}>
                            {item.note || "Reported incorrect by member"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 2: UNANSWERED QUESTIONS */}
          {activeTab === "unanswered" && (
            <div className={styles.tableWrapper}>
              {data.unansweredQuestions.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>✨</span>
                  <p>No unanswered questions recorded.</p>
                </div>
              ) : (
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Asked At</th>
                      <th>Member</th>
                      <th>Question</th>
                      <th>Intent</th>
                      <th>Outcome / Failure Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.unansweredQuestions.map((item) => (
                      <tr key={item.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(item.askedAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          <strong>{item.memberName}</strong>
                          <div style={{ fontSize: "11px", color: "var(--color-on-surface-variant)" }}>
                            #{item.memberNumber}
                          </div>
                        </td>
                        <td style={{ maxWidth: "340px" }}>{item.question}</td>
                        <td>
                          <span className={styles.badgeTag}>{item.intent}</span>
                        </td>
                        <td>
                          <span className={styles.badgeTagWarning}>
                            {item.outcome}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 3: BLOCKED UNGROUNDED */}
          {activeTab === "blocked-ungrounded" && (
            <div className={styles.tableWrapper}>
              {data.blockedUngrounded.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🛡️</span>
                  <p>No answers blocked for ungrounded hallucination risk.</p>
                </div>
              ) : (
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Asked At</th>
                      <th>Member</th>
                      <th>Question</th>
                      <th>Top Similarity Score</th>
                      <th>Candidate Card</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.blockedUngrounded.map((item) => (
                      <tr key={item.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(item.askedAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          <strong>{item.memberName}</strong>
                          <div style={{ fontSize: "11px", color: "var(--color-on-surface-variant)" }}>
                            #{item.memberNumber}
                          </div>
                        </td>
                        <td style={{ maxWidth: "340px" }}>{item.question}</td>
                        <td>
                          <span className={styles.badgeTagDanger}>
                            {item.topScore !== null
                              ? item.topScore.toFixed(3)
                              : "Below threshold"}
                          </span>
                        </td>
                        <td>
                          <strong>{item.cardTitle || "None identified"}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 4: ABANDONED PAYMENTS */}
          {activeTab === "abandoned-payments" && (
            <div className={styles.tableWrapper}>
              {data.abandonedPayments.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>💳</span>
                  <p>No abandoned payment attempts found.</p>
                </div>
              ) : (
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Created At</th>
                      <th>Member</th>
                      <th>Reference</th>
                      <th>Amount</th>
                      <th>Purpose</th>
                      <th>Failure Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.abandonedPayments.map((item) => (
                      <tr key={item.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(item.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          <strong>{item.memberName}</strong>
                          <div style={{ fontSize: "11px", color: "var(--color-on-surface-variant)" }}>
                            #{item.memberNumber}
                          </div>
                        </td>
                        <td>
                          <code>{item.reference}</code>
                        </td>
                        <td>
                          <strong>
                            ₦{(item.amountKobo / 100).toLocaleString()}
                          </strong>
                        </td>
                        <td>
                          <span className={styles.badgeTag}>{item.purpose}</span>
                        </td>
                        <td>
                          <span className={styles.badgeTagWarning}>
                            {item.failureReason || "Session expired without webhook confirmation"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 5: OVERDUE CARDS */}
          {activeTab === "overdue-cards" && (
            <div className={styles.tableWrapper}>
              {data.overdueCards.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>✅</span>
                  <p>All approved knowledge cards are up to date within review intervals.</p>
                </div>
              ) : (
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Card Title</th>
                      <th>Category</th>
                      <th>Min Tier</th>
                      <th>Review Interval</th>
                      <th>Last Confirmed</th>
                      <th>Overdue By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overdueCards.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.title}</strong>
                        </td>
                        <td>
                          <span className={styles.badgeTag}>{item.category}</span>
                        </td>
                        <td>
                          <span className={styles.badgeTag}>{item.minTier}</span>
                        </td>
                        <td>{item.reviewIntervalDays} days</td>
                        <td>
                          {item.lastConfirmedAt
                            ? new Date(item.lastConfirmedAt).toLocaleDateString()
                            : "Never confirmed"}
                        </td>
                        <td>
                          <span className={styles.badgeTagDanger}>
                            {item.daysOverdue} days overdue
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 6: PRIVACY EXCEPTIONS */}
          {activeTab === "privacy-exceptions" && (
            <div className={styles.tableWrapper}>
              {data.privacyExceptions.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🔒</span>
                  <p>Zero privacy exceptions detected. Session member always matches target member.</p>
                </div>
              ) : (
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Access Function</th>
                      <th>Calling Session Member</th>
                      <th>Target Member Read</th>
                      <th>Violation Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.privacyExceptions.map((item) => (
                      <tr key={item.id} className={styles.privacyAlertRow}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(item.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          <code>{item.functionName}</code>
                        </td>
                        <td>
                          <strong>{item.sessionMemberName || "Unknown Member"}</strong>
                          <div style={{ fontSize: "11px", color: "var(--color-on-surface-variant)" }}>
                            ID: {item.sessionMemberId} (
                            {item.sessionMemberNumber ? `#${item.sessionMemberNumber}` : "No #" }
                            )
                          </div>
                        </td>
                        <td>
                          <strong>{item.targetMemberName || "Unknown Target"}</strong>
                          <div style={{ fontSize: "11px", color: "var(--color-on-surface-variant)" }}>
                            ID: {item.targetMemberId} (
                            {item.targetMemberNumber ? `#${item.targetMemberNumber}` : "No #" }
                            )
                          </div>
                        </td>
                        <td>
                          <span className={styles.privacyAlertBadge}>
                            Cross-Member Read Violation
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 7: CHECK-IN ANOMALIES */}
          {activeTab === "checkin-anomalies" && (
            <div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                <button
                  type="button"
                  onClick={() => setCheckInSubTab("spikes")}
                  className={styles.tabButton}
                  style={{
                    backgroundColor:
                      checkInSubTab === "spikes"
                        ? "var(--color-primary-container)"
                        : "transparent",
                    color:
                      checkInSubTab === "spikes"
                        ? "var(--color-on-primary-container)"
                        : "var(--color-on-surface-variant)",
                  }}
                >
                  Daily Spikes (&gt;150% 4-Wk Trailing Avg) ({data.checkInDailySpikes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCheckInSubTab("excess")}
                  className={styles.tabButton}
                  style={{
                    backgroundColor:
                      checkInSubTab === "excess"
                        ? "var(--color-primary-container)"
                        : "transparent",
                    color:
                      checkInSubTab === "excess"
                        ? "var(--color-on-primary-container)"
                        : "var(--color-on-surface-variant)",
                  }}
                >
                  Member Weekly Excess (&gt;7 Days/Wk) ({data.checkInWeeklyExcess.length})
                </button>
              </div>

              {checkInSubTab === "spikes" && (
                <div className={styles.tableWrapper}>
                  {data.checkInDailySpikes.length === 0 ? (
                    <div className={styles.emptyState}>
                      <span className={styles.emptyIcon}>📊</span>
                      <p>No spike days detected where check-ins exceeded 150% of the 4-week trailing average.</p>
                    </div>
                  ) : (
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Day of Week</th>
                          <th>Total Daily Check-ins</th>
                          <th>4-Week Trailing Avg</th>
                          <th>Spike Ratio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.checkInDailySpikes.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <strong>{item.date}</strong>
                            </td>
                            <td>{item.dayOfWeek}</td>
                            <td>
                              <strong>{item.dailyCheckIns}</strong>
                            </td>
                            <td>{item.trailingFourWeekAvg.toFixed(1)}</td>
                            <td>
                              <span className={styles.badgeTagDanger}>
                                +{item.percentageOverAverage.toFixed(0)}% of avg
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {checkInSubTab === "excess" && (
                <div className={styles.tableWrapper}>
                  {data.checkInWeeklyExcess.length === 0 ? (
                    <div className={styles.emptyState}>
                      <span className={styles.emptyIcon}>🛡️</span>
                      <p>No members exceeded the calendar week check-in limit (&gt; 7 check-ins).</p>
                    </div>
                  ) : (
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Calendar Week</th>
                          <th>Member</th>
                          <th>Weekly Check-ins</th>
                          <th>Allowed Limit</th>
                          <th>Excess Factor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.checkInWeeklyExcess.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              {item.weekStartDate} to {item.weekEndDate}
                            </td>
                            <td>
                              <strong>{item.memberName}</strong>
                              <div style={{ fontSize: "11px", color: "var(--color-on-surface-variant)" }}>
                                #{item.memberNumber}
                              </div>
                            </td>
                            <td>
                              <strong>{item.totalCheckIns} check-ins</strong>
                            </td>
                            <td>{item.allowedDays} days/week</td>
                            <td>
                              <span className={styles.badgeTagDanger}>
                                +{item.totalCheckIns - item.allowedDays} excess check-ins
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
