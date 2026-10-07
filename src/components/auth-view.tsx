"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/copy";
import styles from "@/app/auth.module.css";

export type AuthViewKind = "login" | "signup" | "reset";

const LOGIN_HREF = "/auth";
const SIGNUP_HREF = "/auth?view=signup";
const RESET_HREF = "/auth?view=reset";

function useRequiredField(validate?: (value: string) => string, realtime = false) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const getError = (nextValue: string): string => {
    if (nextValue.trim() === "") {
      return copy.validation.fieldRequired;
    }
    return validate ? validate(nextValue) : "";
  };

  const handleChange = (nextValue: string) => {
    setValue(nextValue);
    if (realtime) {
      setError(getError(nextValue));
    } else if (error && getError(nextValue) === "") {
      setError("");
    }
  };

  const handleBlur = () => {
    setError(getError(value));
  };

  const validateOnSubmit = () => {
    const message = getError(value);
    setError(message);
    return message === "";
  };

  const reset = () => {
    setValue("");
    setError("");
  };

  return {
    value,
    error,
    isValid: getError(value) === "",
    handleChange,
    handleBlur,
    validateOnSubmit,
    reset,
  };
}

function FieldError({
  id,
  message,
  polite = false,
}: {
  id: string;
  message: string;
  polite?: boolean;
}) {
  if (!message) {
    return null;
  }

  return (
    <span
      id={id}
      role={polite ? "status" : "alert"}
      className={`text-body-small ${styles.inlineError}`}
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        aria-hidden="true"
        focusable="false"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M12 4 21.5 20h-19L12 4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 10.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="currentColor" />
      </svg>
      {message}
    </span>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.topBar}>
        <Link href="/" className={`text-label-medium ${styles.homeLink}`}>
          &larr; Back to Spotter
        </Link>
        <span className="text-label-small" style={{ color: "var(--color-on-surface-variant)" }}>
          Official Member App
        </span>
      </div>
      {children}
    </div>
  );
}

function LoginView() {
  const router = useRouter();
  const email = useRequiredField();
  const password = useRequiredField();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value, password: password.value }),
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
    <AuthShell>
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
              value={email.value}
              onChange={(e) => email.handleChange(e.target.value)}
              onBlur={email.handleBlur}
              aria-invalid={email.error ? true : undefined}
              aria-describedby={email.error ? "login-email-error" : undefined}
              className={`text-body-medium ${styles.inputControl}${email.error ? ` ${styles.inputError}` : ""}`}
              placeholder="chioma@example.com"
            />
            <FieldError id="login-email-error" message={email.error} />
          </div>

          <div className={styles.formField}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="login-password" className={`text-label-medium ${styles.fieldLabel}`}>
                Password
              </label>
              <Link href={RESET_HREF} className={`text-label-small ${styles.secondaryLink}`}>
                Forgot password?
              </Link>
            </div>
            <div className={styles.passwordWrapper}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password.value}
                onChange={(e) => password.handleChange(e.target.value)}
                onBlur={password.handleBlur}
                aria-invalid={password.error ? true : undefined}
                aria-describedby={password.error ? "login-password-error" : undefined}
                className={`text-body-medium ${styles.passwordInput}${password.error ? ` ${styles.inputError}` : ""}`}
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
            <FieldError id="login-password-error" message={password.error} />
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
            <Link href={SIGNUP_HREF} className={styles.footerLink}>
              Create an account
            </Link>
          </span>
        </div>
      </div>
    </AuthShell>
  );
}

function validateFullName(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return copy.validation.nameMinLength;
  }

  if (trimmed.split(/\s+/).length < 2) {
    return copy.validation.nameTwoWords;
  }

  return "";
}

function validateEmail(value: string): string {
  const trimmed = value.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return copy.validation.emailInvalid;
  }

  return "";
}

function validateMemberNumber(value: string): string {
  if (!/^\d{6}$/.test(value.trim())) {
    return copy.validation.memberNumberInvalid;
  }

  return "";
}

function validatePassword(value: string): string {
  if (value.length < 8) {
    return copy.signup.passwordMinLength;
  }

  return "";
}

function SignUpView() {
  const router = useRouter();
  const name = useRequiredField(validateFullName);
  const email = useRequiredField(validateEmail, true);
  const memberNumber = useRequiredField(validateMemberNumber);
  const password = useRequiredField(validatePassword);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showTermsSignal, setShowTermsSignal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const fieldsValid =
    name.isValid && email.isValid && memberNumber.isValid && password.isValid;
  const formComplete = fieldsValid && acceptedPrivacy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setErrorMsg("");

    if (!name.validateOnSubmit()) {
      return;
    }

    if (!email.validateOnSubmit()) {
      return;
    }

    if (!memberNumber.validateOnSubmit()) {
      return;
    }

    if (!password.validateOnSubmit()) {
      return;
    }

    if (!acceptedPrivacy) {
      setShowTermsSignal(true);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.value,
          email: email.value,
          memberNumber: memberNumber.value,
          password: password.value,
        }),
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
    <AuthShell>
      <div className={styles.authCard}>
        <div className={styles.cardHeader}>
          <div className={`${styles.brandBadge} text-label-large`}>SPOTTER</div>
          <h1 className={`text-title-large ${styles.cardTitle}`}>Create Account</h1>
          <p className={`text-body-small ${styles.cardSubtitle}`}>
            Link your gym card to activate your personal Spotter portal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.cardBody} noValidate>
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
              value={name.value}
              onChange={(e) => name.handleChange(e.target.value)}
              onBlur={name.handleBlur}
              aria-invalid={name.error ? true : undefined}
              aria-describedby={name.error ? "signup-name-error" : undefined}
              className={`text-body-medium ${styles.inputControl}${name.error ? ` ${styles.inputError}` : ""}`}
              placeholder="Chioma Adeyemi"
            />
            <FieldError id="signup-name-error" message={name.error} />
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
              value={email.value}
              onChange={(e) => email.handleChange(e.target.value)}
              onBlur={email.handleBlur}
              aria-invalid={email.error ? true : undefined}
              aria-describedby={email.error ? "signup-email-error" : undefined}
              className={`text-body-medium ${styles.inputControl}${email.error ? ` ${styles.inputError}` : ""}`}
              placeholder="chioma@example.com"
            />
            <FieldError id="signup-email-error" message={email.error} polite />
          </div>

          <div className={styles.formField}>
            <label htmlFor="signup-member-number" className={`text-label-medium ${styles.fieldLabel}`}>
              Member Number
            </label>
            <input
              id="signup-member-number"
              type="text"
              required
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]*"
              value={memberNumber.value}
              onChange={(e) => memberNumber.handleChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onBlur={memberNumber.handleBlur}
              aria-invalid={memberNumber.error ? true : undefined}
              aria-describedby={memberNumber.error ? "signup-member-number-error" : undefined}
              className={`text-body-medium ${styles.inputControl}${memberNumber.error ? ` ${styles.inputError}` : ""}`}
              placeholder="Member number"
            />
            <FieldError id="signup-member-number-error" message={memberNumber.error} />
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
                value={password.value}
                onChange={(e) => password.handleChange(e.target.value)}
                onBlur={password.handleBlur}
                aria-invalid={password.error ? true : undefined}
                aria-describedby={
                  password.error
                    ? "signup-password-error"
                    : password.value !== ""
                      ? "signup-password-hint"
                      : undefined
                }
                className={`text-body-medium ${styles.passwordInput}${password.error ? ` ${styles.inputError}` : ""}`}
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
            <FieldError id="signup-password-error" message={password.error} />
            {password.value !== "" && !password.error && (
              <span
                id="signup-password-hint"
                className={`text-body-small ${styles.fieldHelper}`}
              >
                {copy.signup.passwordMinLength}
              </span>
            )}
          </div>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              required
              onChange={(e) => {
                setAcceptedPrivacy(e.target.checked);
                setShowTermsSignal(false);
              }}
              aria-invalid={showTermsSignal && !acceptedPrivacy ? true : undefined}
              aria-describedby={
                showTermsSignal && !acceptedPrivacy ? "signup-terms-error" : undefined
              }
              className={styles.checkboxInput}
            />
            <span className={`text-body-small ${styles.fieldHelper}`}>
              I accept that Spotter stores my check-in history and email privately for 24 months, accessible only to my member account.
            </span>
          </label>
          <FieldError
            id="signup-terms-error"
            message={
              showTermsSignal && !acceptedPrivacy
                ? copy.validation.acceptTermsRequired
                : ""
            }
          />

          <button
            type="submit"
            aria-disabled={loading || !formComplete}
            aria-describedby={!formComplete ? "signup-submit-hint" : undefined}
            className={`text-label-large ${styles.submitButton}${
              loading || !formComplete ? ` ${styles.submitButtonDisabled}` : ""
            }`}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
          <span id="signup-submit-hint" className={styles.srOnly}>
            {copy.validation.createAccountHint}
          </span>
        </form>

        <div className={styles.cardFooter}>
          <span className={`text-body-small ${styles.fieldHelper}`}>
            Already registered?{" "}
            <Link href={LOGIN_HREF} className={styles.footerLink}>
              Log in to your account
            </Link>
          </span>
        </div>
      </div>
    </AuthShell>
  );
}

function ResetPasswordView() {
  const email = useRequiredField();
  const tempPassword = useRequiredField();
  const newPassword = useRequiredField();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (newPassword.value.length < 8) {
      setErrorMsg(copy.signup.passwordMinLength);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.value,
          tempPassword: tempPassword.value,
          newPassword: newPassword.value,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || copy.login.failed);
      } else {
        setSuccessMsg(copy.tempPassword.success);
        tempPassword.reset();
        newPassword.reset();
      }
    } catch {
      setErrorMsg(copy.login.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
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
              <Link href={LOGIN_HREF} className={`text-label-large ${styles.submitButton}`} style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
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
                  value={email.value}
                  onChange={(e) => email.handleChange(e.target.value)}
                  onBlur={email.handleBlur}
                  aria-invalid={email.error ? true : undefined}
                  aria-describedby={email.error ? "reset-email-error" : undefined}
                  className={`text-body-medium ${styles.inputControl}${email.error ? ` ${styles.inputError}` : ""}`}
                  placeholder="chioma@example.com"
                />
                <FieldError id="reset-email-error" message={email.error} />
              </div>

              <div className={styles.formField}>
                <label htmlFor="temp-password" className={`text-label-medium ${styles.fieldLabel}`}>
                  Temporary Password
                </label>
                <input
                  id="temp-password"
                  type="text"
                  required
                  value={tempPassword.value}
                  onChange={(e) => tempPassword.handleChange(e.target.value)}
                  onBlur={tempPassword.handleBlur}
                  aria-invalid={tempPassword.error ? true : undefined}
                  aria-describedby={tempPassword.error ? "temp-password-error" : undefined}
                  className={`text-body-medium ${styles.inputControl}${tempPassword.error ? ` ${styles.inputError}` : ""}`}
                  placeholder="Enter 24-hr temporary password from desk"
                />
                <FieldError id="temp-password-error" message={tempPassword.error} />
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
                    value={newPassword.value}
                    onChange={(e) => newPassword.handleChange(e.target.value)}
                    onBlur={newPassword.handleBlur}
                    aria-invalid={newPassword.error ? true : undefined}
                    aria-describedby={newPassword.error ? "new-password-error" : undefined}
                    className={`text-body-medium ${styles.passwordInput}${newPassword.error ? ` ${styles.inputError}` : ""}`}
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
                <FieldError id="new-password-error" message={newPassword.error} />
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
            <Link href={LOGIN_HREF} className={styles.footerLink}>
              Return to log in
            </Link>
          </span>
        </div>
      </div>
    </AuthShell>
  );
}

export default function AuthView({ view }: { view: AuthViewKind }) {
  if (view === "signup") {
    return <SignUpView />;
  }

  if (view === "reset") {
    return <ResetPasswordView />;
  }

  return <LoginView />;
}
