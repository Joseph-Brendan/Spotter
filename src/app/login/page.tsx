"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/copy";
import styles from "../auth.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Log In | Spotter";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || copy.login.failed);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setErrorMsg(copy.login.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <title>Log In | Spotter</title>
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
          <h1 className={`text-title-large ${styles.cardTitle}`}>Member Log In</h1>
          <p className={`text-body-small ${styles.cardSubtitle}`}>
            Access your gym check-in code, attendance records, and balance.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.cardBody}>
          {errorMsg && (
            <div className={`text-body-small ${styles.errorMessage}`}>
              {errorMsg}
            </div>
          )}

          <div className={styles.formField}>
            <label htmlFor="login-email" className={`text-label-medium ${styles.fieldLabel}`}>
              Email Address
            </label>
            <input
              id="login-email"
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="login-password" className={`text-label-medium ${styles.fieldLabel}`}>
                Password
              </label>
              <Link href="/reset-password" className={`text-label-small ${styles.secondaryLink}`}>
                Forgot password?
              </Link>
            </div>
            <div className={styles.passwordWrapper}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`text-label-large ${styles.submitButton}`}
          >
            {loading ? "Checking..." : "Log In"}
          </button>
        </form>

        <div className={styles.cardFooter}>
          <span className={`text-body-small ${styles.fieldHelper}`}>
            New to Spotter?{" "}
            <Link href="/signup" className={styles.footerLink}>
              Create an account
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
