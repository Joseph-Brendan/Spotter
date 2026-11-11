"use client";

import { useEffect, useRef } from "react";
import { copy } from "@/lib/copy";
import styles from "@/app/checkin/keypad.module.css";

interface QrScannerProps {
  onDetected: (digits: string) => void;
  onNotCheckInCode: () => void;
  onCameraError: () => void;
}

const SCAN_INTERVAL_MS = 200;
const DIGITS = /^\d{6}$/;

export default function QrScanner({
  onDetected,
  onNotCheckInCode,
  onCameraError,
}: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handlers = useRef({ onDetected, onNotCheckInCode, onCameraError });

  useEffect(() => {
    handlers.current = { onDetected, onNotCheckInCode, onCameraError };
  }, [onDetected, onNotCheckInCode, onCameraError]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let lastRejected = "";
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const start = async () => {
      try {
        // jsQR is loaded only when the camera opens, so the keypad page stays
        // light until someone scans.
        const [{ default: jsQR }, media] = await Promise.all([
          import("jsqr"),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          }),
        ]);

        if (stopped) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = media;
        const video = videoRef.current;

        if (!video || !context) {
          handlers.current.onCameraError();
          return;
        }

        video.srcObject = media;
        await video.play();

        const scan = () => {
          if (stopped) return;

          if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = context.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(frame.data, frame.width, frame.height, {
              inversionAttempts: "dontInvert",
            });
            const value = found?.data.trim() ?? "";

            if (DIGITS.test(value)) {
              stopped = true;
              handlers.current.onDetected(value);
              return;
            }

            if (value && value !== lastRejected) {
              lastRejected = value;
              handlers.current.onNotCheckInCode();
            }
          }

          timer = setTimeout(scan, SCAN_INTERVAL_MS);
        };

        scan();
      } catch {
        if (!stopped) {
          handlers.current.onCameraError();
        }
      }
    };

    void start();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className={styles.scanner}>
      <video
        ref={videoRef}
        className={styles.scannerVideo}
        muted
        playsInline
        aria-hidden="true"
      />
      <p className={styles.scannerHint}>{copy.keypad.scanHint}</p>
    </div>
  );
}
