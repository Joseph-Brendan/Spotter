"use client";

import { useEffect, useState } from "react";
import { useRefreshSession } from "@/hooks/use-auth";

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30;

export type PaymentConfirmationState =
  | "idle"
  | "confirming"
  | "confirmed"
  | "failed"
  | "stillConfirming";

type ServerState = "none" | "pending" | "confirmed" | "failed" | "review";

async function checkPayment(): Promise<ServerState> {
  const response = await fetch("/api/payments/status", {
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    return "pending";
  }

  const data = (await response.json().catch(() => ({}))) as {
    state?: ServerState;
  };

  return data.state ?? "pending";
}

// Polls every two seconds while the screen is visible, for up to thirty
// checks. A failed check never reads as a failed payment: only the gateway
// reporting failure does.
export function usePaymentConfirmation(
  active: boolean
): PaymentConfirmationState {
  const refreshSession = useRefreshSession();
  const [state, setState] = useState<PaymentConfirmationState>(
    active ? "confirming" : "idle"
  );

  useEffect(() => {
    if (!active) {
      return;
    }

    let attempts = 0;
    let stopped = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const stop = (next: PaymentConfirmationState) => {
      stopped = true;
      if (timer) clearTimeout(timer);
      setState(next);
    };

    const schedule = () => {
      if (stopped || document.hidden) return;
      timer = setTimeout(tick, attempts === 0 ? 0 : POLL_INTERVAL_MS);
    };

    const tick = async () => {
      timer = null;
      if (stopped || inFlight || document.hidden) return;

      inFlight = true;
      attempts += 1;
      const result = await checkPayment().catch(
        (): ServerState => "pending"
      );
      inFlight = false;

      if (stopped) return;

      if (result === "confirmed") {
        stop("confirmed");
        void refreshSession();
        return;
      }

      if (result === "failed") {
        stop("failed");
        return;
      }

      if (result === "review" || result === "none" || attempts >= MAX_ATTEMPTS) {
        stop("stillConfirming");
        return;
      }

      schedule();
    };

    const handleVisibility = () => {
      if (!document.hidden && !timer && !inFlight) {
        schedule();
      } else if (document.hidden && timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    schedule();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active, refreshSession]);

  return state;
}
