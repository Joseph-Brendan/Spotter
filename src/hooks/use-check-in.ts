"use client";

import { useCallback, useEffect, useState } from "react";
import { useRefreshSession } from "@/hooks/use-auth";

const POLL_INTERVAL_MS = 2000;

export type CheckInView =
  | { kind: "ready" }
  | { kind: "generating" }
  | {
      kind: "code";
      digits: string;
      expiresAt: number;
      emailed: boolean;
      qrSvg: string | null;
      stillConfirming: boolean;
    }
  | { kind: "checkedIn" }
  | { kind: "expired" }
  | { kind: "alreadyCheckedIn" }
  | { kind: "gymClosed" }
  | { kind: "needsPlan" }
  | { kind: "failed" };

type GenerateResponse =
  | {
      status: "created" | "existing";
      code: string;
      expiresAt: string;
      emailed: boolean;
      qrSvg: string | null;
    }
  | { status: "alreadyCheckedIn" | "gymClosed" | "needsPlan" };

type CodeState = "none" | "waiting" | "checkedIn" | "expired";

async function fetchCodeState(): Promise<CodeState | null> {
  const response = await fetch("/api/checkin/status", { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => ({}))) as {
    state?: CodeState;
  };

  return data.state ?? null;
}

export function useCheckIn(checkedInToday: boolean) {
  const refreshSession = useRefreshSession();
  const [view, setView] = useState<CheckInView>(
    checkedInToday ? { kind: "alreadyCheckedIn" } : { kind: "ready" }
  );

  const generate = useCallback(async () => {
    setView({ kind: "generating" });

    try {
      const response = await fetch("/api/checkin/generate", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        setView({ kind: "failed" });
        return;
      }

      const data = (await response.json()) as GenerateResponse;

      if (data.status === "created" || data.status === "existing") {
        setView({
          kind: "code",
          digits: data.code,
          expiresAt: new Date(data.expiresAt).getTime(),
          emailed: data.emailed,
          qrSvg: data.qrSvg ?? null,
          stillConfirming: false,
        });
        return;
      }

      setView({ kind: data.status });
    } catch {
      setView({ kind: "failed" });
    }
  }, []);

  const polling = view.kind === "code";

  // Polls every two seconds while a code is on screen and the screen is
  // visible. Stops when the code is consumed or expires. A failed poll keeps
  // the code on screen and never reads as a failed check in.
  useEffect(() => {
    if (!polling) {
      return;
    }

    let stopped = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (stopped || document.hidden) return;
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    const tick = async () => {
      timer = null;
      if (stopped || inFlight || document.hidden) return;

      inFlight = true;
      const state = await fetchCodeState().catch(() => null);
      inFlight = false;

      if (stopped) return;

      if (state === "checkedIn") {
        stopped = true;
        setView({ kind: "checkedIn" });
        void refreshSession();
        return;
      }

      if (state === "expired") {
        stopped = true;
        setView({ kind: "expired" });
        return;
      }

      setView((current) =>
        current.kind === "code" &&
        current.stillConfirming !== (state === null)
          ? { ...current, stillConfirming: state === null }
          : current
      );

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
  }, [polling, refreshSession]);

  return { view, generate };
}

export function useCountdown(expiresAt: number | null): number {
  const [remainingMs, setRemainingMs] = useState(() =>
    expiresAt ? Math.max(0, expiresAt - Date.now()) : 0
  );

  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const update = () => setRemainingMs(Math.max(0, expiresAt - Date.now()));
    const first = setTimeout(update, 0);
    const interval = setInterval(update, 1000);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [expiresAt]);

  return remainingMs;
}
