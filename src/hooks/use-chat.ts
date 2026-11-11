"use client";

import { useCallback, useState } from "react";
import { copy } from "@/lib/copy";

/**
 * PROTOTYPE. Talks to POST /api/chat, which answers without source records.
 * Replaced by the ask hook when /api/ask exists.
 */

export type ChatState =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "answered"; reply: string }
  | { status: "refused"; category: string }
  | { status: "error"; message: string };

interface ChatResponse {
  kind?: "answered" | "refused";
  reply?: string;
  category?: string;
  error?: string;
}

export function useChat() {
  const [state, setState] = useState<ChatState>({ status: "idle" });

  const ask = useCallback(async (message: string) => {
    setState({ status: "asking" });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        cache: "no-store",
      });

      const data = (await response.json().catch(() => ({}))) as ChatResponse;

      if (!response.ok) {
        setState({
          status: "error",
          message: data.error ?? copy.chat.unavailable,
        });
        return;
      }

      if (data.kind === "answered" && typeof data.reply === "string") {
        setState({ status: "answered", reply: data.reply });
        return;
      }

      if (data.kind === "refused") {
        setState({ status: "refused", category: data.category ?? "unknown" });
        return;
      }

      setState({ status: "error", message: copy.chat.unavailable });
    } catch {
      // Offline or the request was cut off. Never a cached answer.
      setState({ status: "error", message: copy.chat.unavailable });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, ask, reset };
}
