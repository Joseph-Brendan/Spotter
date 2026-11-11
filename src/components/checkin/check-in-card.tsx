"use client";

import { useState } from "react";
import { useCheckIn, useCountdown } from "@/hooks/use-check-in";
import { copy } from "@/lib/copy";
import type { MembershipStatus } from "@/types/member";
import styles from "@/app/page.module.css";

interface CheckInCardProps {
  status: MembershipStatus;
  checkedInToday: boolean;
  attendanceLabel: string | null;
  onChoosePlan: () => void;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function CheckInCard({
  status,
  checkedInToday,
  attendanceLabel,
  onChoosePlan,
}: CheckInCardProps) {
  const { view, generate } = useCheckIn(checkedInToday);
  const [qrOpen, setQrOpen] = useState(false);
  const remainingMs = useCountdown(view.kind === "code" ? view.expiresAt : null);
  const eligible = status === "active" || status === "grace";
  const showPlanPrompt =
    view.kind === "needsPlan" || (!eligible && view.kind === "ready");

  return (
    <section
      className={styles.checkInCard}
      data-state={view.kind}
      aria-labelledby="check-in-title"
    >
      <h2 id="check-in-title" className={styles.checkInTitle}>
        {copy.checkin.title}
      </h2>

      {showPlanPrompt && (
        <>
          <p className={styles.checkInMessage}>{copy.checkin.needsPlan}</p>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onChoosePlan}
          >
            {status === "new"
              ? copy.payments.choosePlan
              : copy.checkin.renewToCheckIn}
          </button>
        </>
      )}

      {!showPlanPrompt && (view.kind === "ready" || view.kind === "generating") && (
        <button
          type="button"
          className={`${styles.primaryBtn} ${styles.checkInButton}`}
          onClick={() => void generate()}
          disabled={view.kind === "generating"}
        >
          {view.kind === "generating"
            ? copy.checkin.generating
            : copy.checkin.checkInButton}
        </button>
      )}

      {view.kind === "code" && (
        <div className={styles.checkInCode}>
          <p className={styles.checkInMessage}>{copy.checkin.typeCode}</p>
          <p
            className={styles.checkInDigits}
            aria-label={view.digits.split("").join(" ")}
          >
            <span>{view.digits.slice(0, 3)}</span>
            <span>{view.digits.slice(3)}</span>
          </p>
          <p className={styles.checkInCountdown}>
            {copy.checkin.expiresIn(formatRemaining(remainingMs))}
          </p>
          <p className={styles.checkInHint} role="status">
            {view.stillConfirming
              ? copy.checkin.stillConfirming
              : copy.checkin.checkingIn}
          </p>
          {view.emailed && (
            <p className={styles.checkInHint}>{copy.checkin.sentToEmail}</p>
          )}
          {view.qrSvg && (
            <div className={styles.checkInQr}>
              <button
                type="button"
                className={styles.planLink}
                aria-expanded={qrOpen}
                aria-controls="check-in-qr"
                onClick={() => setQrOpen((open) => !open)}
              >
                {qrOpen ? copy.checkin.hideQr : copy.checkin.showQr}
              </button>
              {qrOpen && (
                // eslint-disable-next-line @next/next/no-img-element -- a server drawn data URL, not a remote image
                <img
                  id="check-in-qr"
                  className={styles.checkInQrImage}
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(view.qrSvg)}`}
                  alt={copy.checkin.qrAlt}
                  width={220}
                  height={220}
                />
              )}
            </div>
          )}
        </div>
      )}

      {view.kind === "checkedIn" && (
        <div className={styles.checkInDone} role="status">
          <p className={styles.checkInDoneTitle}>{copy.checkin.checkedIn}</p>
          {attendanceLabel && (
            <p className={styles.checkInHint}>{attendanceLabel}</p>
          )}
        </div>
      )}

      {view.kind === "alreadyCheckedIn" && (
        <p className={styles.checkInMessage} role="status">
          {copy.checkin.alreadyCheckedIn}
        </p>
      )}

      {view.kind === "gymClosed" && (
        <p className={styles.checkInMessage} role="status">
          {copy.checkin.gymClosed}
        </p>
      )}

      {view.kind === "expired" && (
        <>
          <p className={styles.checkInMessage} role="status">
            {copy.checkin.codeExpired}
          </p>
          <button
            type="button"
            className={`${styles.primaryBtn} ${styles.checkInButton}`}
            onClick={() => void generate()}
          >
            {copy.checkin.newCodeButton}
          </button>
        </>
      )}

      {view.kind === "failed" && (
        <>
          <p className={`${styles.checkInMessage} ${styles.verifyError}`} role="alert">
            {copy.checkin.generateFailed}
          </p>
          <button
            type="button"
            className={`${styles.primaryBtn} ${styles.checkInButton}`}
            onClick={() => void generate()}
          >
            {copy.checkin.checkInButton}
          </button>
        </>
      )}
    </section>
  );
}
