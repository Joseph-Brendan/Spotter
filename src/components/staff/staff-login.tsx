"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { loginStaffAction } from "@/app/staff/actions";
import { copy } from "@/lib/copy";
import type { StaffLoginActionState } from "@/types/staff";
import styles from "@/app/staff/staff.module.css";

const INITIAL_STATE: StaffLoginActionState = {};

export default function StaffLogin() {
  const [state, formAction, pending] = useActionState(
    loginStaffAction,
    INITIAL_STATE
  );
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state.error) {
      return;
    }

    if (passwordRef.current) {
      passwordRef.current.value = "";
      passwordRef.current.focus();
    }
  }, [state.error]);

  return (
    <main className={styles.page}>
      <div className={styles.topBar} style={{ maxWidth: "440px" }}>
        <Link
          href="/"
          className={`${styles.brand} text-label-large`}
          aria-label="Spotter home"
        >
          SPOTTER
        </Link>
        <span className={`text-label-small ${styles.topBarNote}`}>
          Staff only
        </span>
      </div>

      <div className={styles.loginShell}>
        <section className={styles.card} aria-labelledby="staff-login-title">
          <header className={styles.cardHeader}>
            <h1
              id="staff-login-title"
              className={`text-title-large ${styles.title}`}
            >
              {copy.staff.loginTitle}
            </h1>
            <p className={`text-body-small ${styles.subtitle}`}>
              {copy.staff.loginSubtitle}
            </p>
          </header>

          <form action={formAction} className={styles.cardBody}>
            {state.error && (
              <div role="alert" className={`text-body-small ${styles.error}`}>
                {state.error}
              </div>
            )}

            <div className={styles.field}>
              <label
                htmlFor="staff-email"
                className={`text-label-medium ${styles.label}`}
              >
                {copy.staff.emailLabel}
              </label>
              <input
                id="staff-email"
                name="email"
                type="email"
                required
                autoComplete="username"
                className={`text-body-medium ${styles.input}`}
                placeholder="name@example.com"
              />
            </div>

            <div className={styles.field}>
              <label
                htmlFor="staff-password"
                className={`text-label-medium ${styles.label}`}
              >
                {copy.staff.passwordLabel}
              </label>
              <input
                ref={passwordRef}
                id="staff-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className={`text-body-medium ${styles.input}`}
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className={styles.button}
            >
              {pending ? copy.staff.signingIn : copy.staff.signInButton}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
