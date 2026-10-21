"use client";

import { useActionState, useState } from "react";
import {
  logoutStaffAction,
  reserveMemberNumberAction,
} from "@/app/staff/actions";
import { copy } from "@/lib/copy";
import type {
  MembershipManagementData,
  ReserveMemberNumberActionState,
} from "@/types/staff";
import styles from "@/app/staff/staff.module.css";
import MembershipManagement from "./membership-management";

const INITIAL_STATE: ReserveMemberNumberActionState = { status: "idle" };

interface StaffDashboardProps {
  staff: {
    name: string;
    role: string;
  };
  latestMemberNumber: string | null;
  membershipManagement: MembershipManagementData | null;
}

export default function StaffDashboard({
  staff,
  latestMemberNumber,
  membershipManagement,
}: StaffDashboardProps) {
  const [state, formAction, pending] = useActionState(
    reserveMemberNumberAction,
    INITIAL_STATE
  );
  const [showForm, setShowForm] = useState(false);

  const isFresh = state.status === "success";
  const reservedNumber = isFresh ? state.memberNumber : latestMemberNumber;
  const roleLabel =
    staff.role === "OWNER" ? copy.staff.roleOwner : copy.staff.roleStaff;
  const resultHint = isFresh
    ? state.emailSent
      ? copy.staff.reservedHintEmailSent
      : copy.staff.reservedHintEmailFailed
    : copy.staff.latestHint;

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <span className={`${styles.brand} text-label-large`}>SPOTTER</span>
        <span className={`text-label-small ${styles.topBarNote}`}>
          Staff area
        </span>
      </div>

      <div className={styles.shell}>
        <section
          className={styles.card}
          aria-labelledby="staff-dashboard-title"
        >
          <header className={styles.cardHeader}>
            <h1
              id="staff-dashboard-title"
              className={`text-title-large ${styles.title}`}
            >
              {copy.staff.dashboardTitle}
            </h1>
            <p className={`text-body-small ${styles.subtitle}`}>
              {copy.staff.dashboardSubtitle}
            </p>
          </header>

          <div className={styles.cardBody}>
            <div className={styles.metaRow}>
              <div className={styles.who}>
                <span className={`text-body-small ${styles.whoRole}`}>
                  {copy.staff.signedInAs}
                </span>
                <span className={`text-body-medium ${styles.whoName}`}>
                  {staff.name}
                </span>
                <span className={`text-body-small ${styles.whoRole}`}>
                  {roleLabel}
                </span>
              </div>

              <form action={logoutStaffAction} className={styles.logoutForm}>
                <button type="submit" className={styles.secondaryButton}>
                  {copy.staff.signOut}
                </button>
              </form>
            </div>

            {reservedNumber && (
              <div className={styles.result} aria-live="polite">
                <span className={styles.resultLabel}>
                  {isFresh
                    ? copy.staff.reservedTitle
                    : copy.staff.latestTitle}
                </span>
                <span className={styles.resultValue}>#{reservedNumber}</span>
                <p className={`text-body-small ${styles.hint}`}>
                  {resultHint}
                </p>
              </div>
            )}

            {state.status === "error" && state.error && (
              <div role="alert" className={`text-body-small ${styles.error}`}>
                {state.error}
              </div>
            )}

            {showForm ? (
              <form
                key={state.memberNumber ?? "new"}
                action={formAction}
                className={styles.reserveForm}
              >
                <div className={styles.field}>
                  <label
                    htmlFor="member-email"
                    className={`text-label-medium ${styles.label}`}
                  >
                    {copy.staff.memberEmailLabel}
                  </label>
                  <input
                    id="member-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className={`text-body-medium ${styles.input}`}
                    placeholder="member@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={pending}
                  className={styles.button}
                >
                  {pending
                    ? copy.staff.generating
                    : copy.staff.generateButton}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className={styles.button}
              >
                {reservedNumber
                  ? copy.staff.reserveAgain
                  : copy.staff.reserveButton}
              </button>
            )}
          </div>
        </section>

        {membershipManagement && (
          <MembershipManagement data={membershipManagement} />
        )}
      </div>
    </main>
  );
}
