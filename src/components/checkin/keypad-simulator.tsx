"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QrScanner from "@/components/checkin/qr-scanner";
import { copy } from "@/lib/copy";
import styles from "@/app/checkin/keypad.module.css";

type KeypadResult =
  | "idle"
  | "checking"
  | "checkedIn"
  | "alreadyCheckedIn"
  | "refused"
  | "blocked"
  | "unreachable"
  | "notCheckInQr"
  | "cameraUnavailable";

type EntryMethod = "keypad" | "qr";

const RESULT_MESSAGE: Record<Exclude<KeypadResult, "idle" | "checking">, string> = {
  checkedIn: copy.keypad.checkedIn,
  alreadyCheckedIn: copy.keypad.alreadyCheckedIn,
  refused: copy.keypad.refused,
  blocked: copy.keypad.blocked,
  unreachable: copy.keypad.unreachable,
  notCheckInQr: copy.keypad.notCheckInQr,
  cameraUnavailable: copy.keypad.cameraUnavailable,
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const RESET_AFTER_MS = 4000;

export default function KeypadSimulator() {
  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<KeypadResult>("idle");
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (result === "idle" || result === "checking") {
      return;
    }

    const timer = setTimeout(() => {
      setResult("idle");
      setDigits("");
      inputRef.current?.focus();
    }, RESET_AFTER_MS);

    return () => clearTimeout(timer);
  }, [result]);

  const setEntry = (value: string) => {
    setDigits(value.replace(/\D/g, "").slice(0, 6));
    if (result !== "checking") {
      setResult("idle");
    }
  };

  const submit = async (entry: string, method: EntryMethod) => {
    if (entry.length !== 6 || result === "checking") {
      return;
    }

    setResult("checking");

    try {
      const response = await fetch("/api/checkin/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digits: entry, method }),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        status?: string;
      };

      if (
        data.status === "checkedIn" ||
        data.status === "alreadyCheckedIn" ||
        data.status === "refused" ||
        data.status === "blocked"
      ) {
        setResult(data.status);
        return;
      }

      setResult("unreachable");
    } catch {
      setResult("unreachable");
    }
  };

  // The scanner keeps stable callbacks, so it reaches the latest submit
  // through a ref instead of restarting the camera on every render.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });

  const handleScanned = useCallback((scanned: string) => {
    setScanning(false);
    setDigits(scanned);
    void submitRef.current(scanned, "qr");
  }, []);

  const handleNotCheckInQr = useCallback(() => setResult("notCheckInQr"), []);

  const handleCameraError = useCallback(() => {
    setScanning(false);
    setResult("cameraUnavailable");
  }, []);

  const busy = result === "checking";
  const message =
    result === "idle" || result === "checking" ? "" : RESULT_MESSAGE[result];

  return (
    <main className={styles.page}>
      <div className={styles.device} data-result={result}>
        <header className={styles.header}>
          <h1 className={styles.title}>{copy.keypad.title}</h1>
          <p className={styles.notice}>{copy.keypad.simulatedNotice}</p>
        </header>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void submit(digits, "keypad");
          }}
        >
          <label htmlFor="keypad-code" className={styles.label}>
            {copy.keypad.codeLabel}
          </label>
          <input
            ref={inputRef}
            id="keypad-code"
            className={styles.display}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{6}"
            maxLength={6}
            value={digits}
            onChange={(event) => setEntry(event.target.value)}
            disabled={busy}
            aria-describedby="keypad-result"
            autoFocus
          />

          <div className={styles.keys}>
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={styles.key}
                onClick={() => setEntry(digits + key)}
                disabled={busy || digits.length >= 6}
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              className={`${styles.key} ${styles.keySecondary}`}
              onClick={() => setEntry("")}
              disabled={busy || digits.length === 0}
            >
              {copy.keypad.clearButton}
            </button>
            <button
              type="button"
              className={styles.key}
              onClick={() => setEntry(digits + "0")}
              disabled={busy || digits.length >= 6}
            >
              0
            </button>
            <button
              type="submit"
              className={`${styles.key} ${styles.keyEnter}`}
              disabled={busy || digits.length !== 6}
            >
              {busy ? copy.keypad.entering : copy.keypad.enterButton}
            </button>
          </div>
        </form>

        <p id="keypad-result" className={styles.result} role="status">
          {message}
        </p>

        <div className={styles.scanSection}>
          <button
            type="button"
            className={styles.scanButton}
            aria-expanded={scanning}
            onClick={() => {
              setResult("idle");
              setScanning((open) => !open);
            }}
            disabled={busy}
          >
            {scanning ? copy.keypad.stopScanButton : copy.keypad.scanButton}
          </button>

          {scanning && (
            <QrScanner
              onDetected={handleScanned}
              onNotCheckInCode={handleNotCheckInQr}
              onCameraError={handleCameraError}
            />
          )}
        </div>
      </div>
    </main>
  );
}
