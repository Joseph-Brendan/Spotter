"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import styles from "../auth.module.css";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Reset Password | Spotter";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (newPassword.length < 8) {
      setErrorMsg(copy.signup.passwordMinLength);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tempPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || copy.login.failed);
      } else {
        setSuccessMsg(copy.tempPassword.success);
        setTempPassword("");
        setNewPassword("");
      }
    } catch {
      setErrorMsg(copy.login.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <title>Reset Password | Spotter</title>
      <div className={styles.topBar}>
        <Link href="/" className={`text-label-medium ${styles.homeLink}`}>
          &larr; Back to Spotter
        </Link>
        <span className="text-label-small" style={{ color: "var(--color-on-surface-variant)" }}>
          Official Member App
        </span>
      </div>

      <div className={styles.authCard}>
        <div className={styles.cardHeader}>
          <div className={`${styles.brandBadge} text-label-large`}>SPOTTER</div>
          <h1 className={`text-title-large ${styles.cardTitle}`}>Reset Password</h1>
          <p className={`text-body-small ${styles.cardSubtitle}`}>
            {copy.tempPassword.prompt}
          </p>
        </div>

        <div className={styles.cardBody}>
          <div className={`text-body-small ${styles.noticeBox}`}>
            {copy.tempPassword.deskNotice}
          </div>

          {errorMsg && (
            <div className={`text-body-small ${styles.errorMessage}`}>
              {errorMsg}
            </div>
          )}

          {successMsg ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className={`text-body-small ${styles.successMessage}`}>
                {successMsg}
              </div>
              <Link href="/login" className={`text-label-large ${styles.submitButton}`} style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
                Proceed to Log In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div className={styles.formField}>
                <label htmlFor="reset-email" className={`text-label-medium ${styles.fieldLabel}`}>
                  Email Address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`text-body-medium ${styles.inputControl}`}
                  placeholder="chioma@example.com"
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="temp-password" className={`text-label-medium ${styles.fieldLabel}`}>
                  Temporary Password
                </label>
                <input
                  id="temp-password"
                  type="text"
                  required
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className={`text-body-medium ${styles.inputControl}`}
                  placeholder="Enter 24-hr temporary password from desk"
                />
                <span className={`text-body-small ${styles.fieldHelper}`}>
                  Issued directly by the gym owner or front desk officer.
                </span>
              </div>

              <div className={styles.formField}>
                <label htmlFor="new-password" className={`text-label-medium ${styles.fieldLabel}`}>
                  New Password
                </label>
                <div className={styles.passwordWrapper}>
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`text-body-medium ${styles.passwordInput}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`text-label-small ${styles.toggleButton}`}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <span className={`text-body-small ${styles.fieldHelper}`}>
                  {copy.signup.passwordMinLength}
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`text-label-large ${styles.submitButton}`}
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}
        </div>

        <div className={styles.cardFooter}>
          <span className={`text-body-small ${styles.fieldHelper}`}>
            Remember your credentials?{" "}
            <Link href="/login" className={styles.footerLink}>
              Return to log in
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
