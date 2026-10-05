"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/copy";
import styles from "../auth.module.css";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [memberNumber, setMemberNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Sign Up | Spotter";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!memberNumber.trim()) {
      setErrorMsg(copy.signup.enterMemberNumber);
      return;
    }

    if (password.length < 8) {
      setErrorMsg(copy.signup.passwordMinLength);
      return;
    }

    if (!acceptedPrivacy) {
      setErrorMsg("Please accept the privacy terms to continue.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, memberNumber, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || copy.signup.memberNumberNotFound);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setErrorMsg(copy.signup.memberNumberNotFound);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <title>Sign Up | Spotter</title>
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
          <h1 className={`text-title-large ${styles.cardTitle}`}>Create Account</h1>
          <p className={`text-body-small ${styles.cardSubtitle}`}>
            Link your gym card to activate your personal Spotter portal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.cardBody}>
          {errorMsg && (
            <div className={`text-body-small ${styles.errorMessage}`}>
              {errorMsg}
            </div>
          )}

          <div className={styles.formField}>
            <label htmlFor="signup-name" className={`text-label-medium ${styles.fieldLabel}`}>
              Full Name
            </label>
            <input
              id="signup-name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`text-body-medium ${styles.inputControl}`}
              placeholder="Chioma Adeyemi"
            />
          </div>

          <div className={styles.formField}>
            <label htmlFor="signup-email" className={`text-label-medium ${styles.fieldLabel}`}>
              Email Address
            </label>
            <input
              id="signup-email"
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
            <label htmlFor="signup-member-number" className={`text-label-medium ${styles.fieldLabel}`}>
              Member Number
            </label>
            <input
              id="signup-member-number"
              type="text"
              required
              value={memberNumber}
              onChange={(e) => setMemberNumber(e.target.value)}
              className={`text-body-medium ${styles.inputControl}`}
              placeholder="e.g. 1042"
            />
            <span className={`text-body-small ${styles.fieldHelper}`}>
              {copy.signup.enterMemberNumber}
            </span>
          </div>

          <div className={styles.formField}>
            <label htmlFor="signup-password" className={`text-label-medium ${styles.fieldLabel}`}>
              Password
            </label>
            <div className={styles.passwordWrapper}>
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(e) => setAcceptedPrivacy(e.target.checked)}
              className={styles.checkboxInput}
            />
            <span className={`text-body-small ${styles.fieldHelper}`}>
              I accept that Spotter stores my check-in history and email privately for 24 months, accessible only to my member account.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className={`text-label-large ${styles.submitButton}`}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className={styles.cardFooter}>
          <span className={`text-body-small ${styles.fieldHelper}`}>
            Already registered?{" "}
            <Link href="/login" className={styles.footerLink}>
              Log in to your account
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
