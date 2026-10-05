"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import MemberPortal, { type SessionMember } from "@/components/member-portal";
import { copy } from "@/lib/copy";
import styles from "@/app/page.module.css";

const FEATURES = [
  {
    num: "01",
    title: "Check In",
    desc: "Generate a single-use six-digit code in the app and enter it at the door keypad for immediate arrival confirmation.",
  },
  {
    num: "02",
    title: "My Records",
    desc: "Private attendance history and exact ledger balance read strictly by your authenticated member account.",
  },
  {
    num: "03",
    title: "Ask About The Gym",
    desc: "Direct answers grounded only in the gym's approved written records. Outdated or missing answers are never guessed.",
  },
  {
    num: "04",
    title: "Pay & Renew",
    desc: "Renew subscriptions or clear arrears via Flutterwave. Confirmed payments extend your membership instantly.",
  },
  {
    num: "05",
    title: "Ask The Desk",
    desc: "When records hold no answer, Spotter names the officer on duty and opens WhatsApp with your question pre-typed.",
  },
];

export default function HomeView() {
  const [member, setMember] = useState<SessionMember | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.member) {
          setMember(data.member);
          document.title = "Member Portal | Spotter";
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/session", { method: "POST" });
    setMember(null);
    document.title = "Spotter | Official Gym Member Portal";
  };

  return (
    <div className={styles.pageContainer}>
      {/* Minimalist Top Navbar */}
      <header className={styles.navbar}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.brandGroup} aria-label="Spotter">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 32"
              width="32"
              height="32"
              aria-hidden="true"
            >
              <rect width="32" height="32" rx="4" fill="var(--color-primary, #0044e3)" />
              <text
                x="50%"
                y="54%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontWeight="700"
                fontSize="20"
              >
                S
              </text>
            </svg>
          </Link>

          <div className={styles.navActions}>
            {member ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span className="text-label-medium" style={{ color: "var(--color-on-surface)" }}>
                  {member.name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={styles.outlineBtn}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link href="/signup" className={styles.primaryBtn}>
                {copy.nav.getStarted}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {member ? (
          /* Active Logged-In Member View */
          <section aria-label="Member Portal Dashboard">
            <MemberPortal member={member} onLogout={handleLogout} />
          </section>
        ) : (
          /* Minimalist Marketing & App Overview */
          <>
            {/* Minimal Hero */}
            <section className={styles.heroSection} aria-label="Welcome">
              <span className={styles.pillTag}>100% Approved Gym Records</span>
              <h1 className={styles.heroTitle}>
                Your Gym. Your Records. Instant Access.
              </h1>
              <p className={styles.heroSubtitle}>
                Spotter is designed for gym members. Generate your check-in code, view your verified personal attendance and ledger balance, and get verified answers anytime.
              </p>
              <div className={styles.heroCtaRow}>
                <Link href="/login" className={styles.primaryBtn}>
                  Log In to Member Portal
                </Link>
                <Link href="/signup" className={styles.outlineBtn}>
                  Create Account
                </Link>
                <Link href="/reset-password" className={styles.linkReset}>
                  Have a temporary password? Reset here &rarr;
                </Link>
              </div>
            </section>

            {/* Five MVP Features */}
            <section className={styles.featuresSection} aria-label="Core Member Features">
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Built For Member Independence</h2>
                <p className={styles.sectionSubtitle}>
                  Five core features with zero clutter, zero ads, and instant confirmation.
                </p>
              </div>

              <div className={styles.featuresGrid}>
                {FEATURES.map((feat) => (
                  <article key={feat.num} className={styles.featureCard}>
                    <span className={styles.featureNum}>{feat.num}</span>
                    <h3 className={styles.featureName}>{feat.title}</h3>
                    <p className={styles.featureDesc}>{feat.desc}</p>
                  </article>
                ))}
              </div>
            </section>

            {/* Privacy & Trust Banner */}
            <section className={styles.trustBanner} aria-label="Privacy Notice">
              <p className={styles.trustText}>
                <strong className={styles.trustHighlight}>Private by design.</strong>{" "}
                Your records are accessed only by your session member ID. Never embedded, never searched across other members, and no push notifications or marketing spam.
              </p>
              <Link href="/login" className={styles.outlineBtn} style={{ whiteSpace: "nowrap" }}>
                Access Records &rarr;
              </Link>
            </section>
          </>
        )}
      </main>

      {/* Minimalist Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerText}>
            Spotter &bull; Gym Member System
          </span>
          <div className={styles.footerLinks}>
            <Link href="/login" className={styles.footerLink}>
              Log In
            </Link>
            <Link href="/signup" className={styles.footerLink}>
              Sign Up
            </Link>
            <Link href="/reset-password" className={styles.footerLink}>
              Reset Password
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
