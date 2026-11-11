"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { copy } from "@/lib/copy";
import styles from "@/app/staff/staff.module.css";

// The drawer and its plan editor are a separate chunk: they load on first open,
// not with the dashboard.
const PlansDrawer = dynamic(() => import("@/components/staff/plans-drawer"), {
  ssr: false,
});

export default function MembershipPlans() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  function openDrawer() {
    setMounted(true);
    setOpen(true);
  }

  function closeDrawer() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.plansTrigger}
        aria-haspopup="dialog"
        aria-label={copy.staff.plansTitle}
        onClick={openDrawer}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
          <path d="M7 7h.01" />
        </svg>
        <span>{copy.staff.plansTitle}</span>
      </button>

      {mounted && <PlansDrawer open={open} onClose={closeDrawer} />}
    </>
  );
}
