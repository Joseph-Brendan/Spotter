"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import MemberPortal, { type SessionMember } from "@/components/member-portal";
import LegalDocumentView, { type LegalView } from "@/components/legal-document";
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
];

export default function HomeView() {
  const [member, setMember] = useState<SessionMember | null>(null);
  const [legalView, setLegalView] = useState<LegalView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.member) {
          setMember(data.member);
          setMenuOpen(false);
          document.title = "Member Portal | Spotter";
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const menu = menuRef.current;
    const menuButton = menuButtonRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }

      if (event.key !== "Tab" || !menu) return;

      const focusable = menu.querySelectorAll<HTMLElement>("a[href], button");
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !menu.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    menuCloseRef.current?.focus();

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
      menuButton?.focus();
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await fetch("/api/auth/session", { method: "POST" });
    setMember(null);
    setMenuOpen(false);
    document.title = "Spotter | Official Gym Member Portal";
  };

  const openLegalView = (view: LegalView) => {
    setLegalView(view);
    window.scrollTo(0, 0);
  };

  const closeLegalView = () => {
    setLegalView(null);
    window.scrollTo(0, 0);
  };

  return (
    <div className={styles.pageContainer}>
      {/* Minimalist Top Navbar */}
      <header className={styles.navbar}>
        <nav className={styles.navInner} aria-label="Main">
          <Link href="/" className={styles.brandGroup} aria-label="Spotter" onClick={closeLegalView}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 32"
              width="32"
              height="32"
              aria-hidden="true"
            >
              <rect width="32" height="32" rx="0" fill="var(--color-primary, #0044e3)" />
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
              <>
                <Link
                  href="/signup"
                  className={`${styles.primaryBtn} ${styles.navCta}`}
                >
                  {copy.nav.getStarted}
                </Link>
                <button
                  type="button"
                  ref={menuButtonRef}
                  className={styles.menuButton}
                  aria-label="Menu"
                  aria-expanded={menuOpen}
                  aria-controls="mobile-menu"
                  onClick={() => setMenuOpen(true)}
                >
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                    <path
                      d="M3 6h18M3 12h18M3 18h18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      {!member && (
        <div
          id="mobile-menu"
          ref={menuRef}
          className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <button
            type="button"
            ref={menuCloseRef}
            className={styles.menuClose}
            aria-label="Close"
            onClick={() => setMenuOpen(false)}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <Link
            href="/signup"
            className={`${styles.primaryBtn} ${styles.mobileMenuCta}`}
            onClick={() => setMenuOpen(false)}
          >
            {copy.nav.getStarted}
          </Link>
        </div>
      )}

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {legalView ? (
          <LegalDocumentView
            view={legalView}
            onBack={closeLegalView}
            onSelectView={openLegalView}
          />
        ) : member ? (
          /* Active Logged-In Member View */
          <section>
            <MemberPortal member={member} onLogout={handleLogout} />
          </section>
        ) : (
          /* Minimalist Marketing & App Overview */
          <>
            {/* Minimal Hero */}
            <section className={styles.heroSection} aria-labelledby="home-hero-title">
              <h1 id="home-hero-title" className={`text-display-medium ${styles.heroTitle}`}>
                Your Gym. Your Records.{" "}
                <span className={styles.heroLineBreak}>Instant Access.</span>
              </h1>
              <p className={`text-body-large ${styles.heroSubtitle}`}>
                {copy.marketing.heroSubtitleLead}
                <span className={styles.heroSubtitleLine}>
                  {copy.marketing.heroSubtitleTail}
                </span>
              </p>
              <div className={styles.heroCtaRow}>
                <Link href="/signup" className={styles.primaryBtn}>
                  {copy.nav.getStartedForFree}
                </Link>
              </div>
            </section>

            {/* Five MVP Features */}
            <section className={styles.featuresSection} aria-labelledby="home-features-title">
              <div className={styles.sectionHeader}>
                <h2 id="home-features-title" className={`text-headline-small ${styles.sectionTitle}`}>Built For Member Independence</h2>
                <p className={styles.sectionSubtitle}>
                  Zero clutter, zero ads, instant confirmation.
                </p>
              </div>

              <div className={styles.featuresGrid}>
                {FEATURES.map((feat) => (
                  <article key={feat.num} className={styles.featureCard}>
                    <span className={`text-label-large ${styles.featureNum}`}>{feat.num}</span>
                    <h3 className={`text-title-medium ${styles.featureName}`}>{feat.title}</h3>
                    <p className={`text-body-medium ${styles.featureDesc}`}>{feat.desc}</p>
                  </article>
                ))}
              </div>
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
            <button
              type="button"
              onClick={() => openLegalView("privacy")}
              className={styles.footerLink}
            >
              {copy.nav.privacyPolicy}
            </button>
            <button
              type="button"
              onClick={() => openLegalView("terms")}
              className={styles.footerLink}
            >
              {copy.nav.termsOfService}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
