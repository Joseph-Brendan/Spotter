"use client";

import { useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import styles from "@/app/page.module.css";

export interface SessionMember {
  memberId: string;
  name: string;
  email: string;
  memberNumber: string;
}

interface MemberPortalProps {
  member: SessionMember;
  onLogout: () => void;
}

const DEFAULT_QUESTIONS = [
  "What time is the Saturday class?",
  "Can I bring a guest with me?",
  "Why is my card not working before six?",
  "What are the gym access hours?",
  "What is the current subscription price?",
  "How do I pause my membership?",
  "What training plans are available?",
  "Who is the trainer on duty today?",
];

export default function MemberPortal({ member, onLogout }: MemberPortalProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  return (
    <section className={styles.dashboardCard} aria-labelledby="member-portal-title">
      <div className={styles.memberHeader}>
        <div>
          <h2 id="member-portal-title" className="text-title-large" style={{ margin: 0 }}>
            {member.name}
          </h2>
          <span className="text-body-small" style={{ color: "var(--color-on-surface-variant)" }}>
            {member.email}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span className={`text-label-large ${styles.memberNumberBadge}`}>
            #{member.memberNumber}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className={styles.outlineBtn}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* 6.2 Status Area: Tier, Expiry, Days trained this month, Balance */}
      <div className={styles.statusTiles}>
        <div className={styles.statusTile}>
          <span className={styles.statusTileLabel}>
            Effective Tier
          </span>
          <span className={styles.statusTileValue}>
            Basic Member
          </span>
        </div>

        <div className={styles.statusTile}>
          <span className={styles.statusTileLabel}>
            Expiry Date
          </span>
          <span className={styles.statusTileValue}>
            Active
          </span>
        </div>

        <div className={styles.statusTile}>
          <span className={styles.statusTileLabel}>
            Attendance
          </span>
          {/* PRD 6.2 Empty State: "0 days this month" */}
          <span className={styles.statusTileValue}>
            {copy.empty.zeroDaysThisMonth}
          </span>
        </div>

        <div className={styles.statusTile}>
          <span className={styles.statusTileLabel}>
            Balance
          </span>
          <span className={styles.statusTileValue}>
            {copy.payments.nothingDue}
          </span>
        </div>
      </div>

      {/* 8 Tappable questions (FR-9) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h3 className={styles.questionsHeader}>
          Ask About The Gym
        </h3>
        <span className="text-body-small" style={{ color: "var(--color-on-surface-variant)" }}>
          Tapped questions skip model calls and verify against approved gym records.
        </span>

        <div className={styles.questionsGrid}>
          {DEFAULT_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              className={styles.questionButton}
              onClick={() => setSelectedQuestion(q)}
            >
              {q}
            </button>
          ))}
        </div>

        <p className={styles.srOnly} role="status">
          {selectedQuestion
            ? `${selectedQuestion} ${copy.refusals.records}`
            : ""}
        </p>

        {selectedQuestion && (
          <div className={styles.bannerNotice}>
            <span className="text-label-medium" style={{ fontWeight: 700, color: "var(--color-on-surface)" }}>
              {selectedQuestion}
            </span>
            <span className="text-body-small">
              {copy.refusals.records}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--color-outline-variant)", paddingTop: "1rem" }}>
        <span className="text-body-small" style={{ color: "var(--color-on-surface-variant)" }}>
          Need assistance with personal records or waivers?
        </span>
        <Link href="/auth?view=reset" className={styles.linkReset}>
          Manage Password
        </Link>
      </div>
    </section>
  );
}
