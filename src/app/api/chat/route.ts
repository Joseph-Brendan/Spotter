import { NextResponse } from "next/server";

import { copy } from "@/lib/copy";
import { ModelError } from "@/server/ai/gemini";
import { answerPrototypeQuestion } from "@/server/ask/prototype-chat";
import { chatRequestSchema } from "@/server/ask/validation";
import { getMemberSession } from "@/server/auth/session";

/**
 * PROTOTYPE chat endpoint. Not the ask endpoint.
 *
 * It reaches the model with no retrieval, no source records, no tier filter,
 * no thirty card gate, no QuestionLog row and no grounding check, at the
 * owner's explicit direction, so the dashboard field can be wired before the
 * pipeline exists. The real endpoint is POST /api/ask, described in
 * docs/spotter-rag-and-ai-guide.md step 10.
 *
 * Kept from the real design on purpose:
 * - a member session is required, so this is not an open proxy on the key;
 * - the deterministic never answer check runs before the model;
 * - nothing is cached.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const session = await getMemberSession();

    if (!session) {
      return NextResponse.json(
        { error: copy.payments.signInRequired },
        { status: 401, headers: NO_STORE }
      );
    }

    if (session.mustChangePassword) {
      return NextResponse.json(
        { error: copy.tempPassword.prompt },
        { status: 403, headers: NO_STORE }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: copy.chat.invalidQuestion },
        { status: 400, headers: NO_STORE }
      );
    }

    const result = await answerPrototypeQuestion({
      memberId: session.memberId,
      question: parsed.data.message,
      selfName: session.name,
    });

    if (result.kind === "rate_limited") {
      return NextResponse.json(
        {
          error: copy.chat.rateLimited,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            ...NO_STORE,
            "Retry-After": String(result.retryAfterSeconds),
          },
        }
      );
    }

    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ModelError) {
      // Stage, failure and HTTP status only. Never the question, the reply or
      // the key.
      console.error(
        "[chat] Model call failed:",
        error.stage,
        error.failure,
        error.status ?? "no-status"
      );

      return NextResponse.json(
        { error: copy.chat.unavailable },
        { status: 502, headers: NO_STORE }
      );
    }

    console.error(
      "[chat] Unhandled failure:",
      error instanceof Error ? error.name : "unknown"
    );

    return NextResponse.json(
      { error: copy.chat.unavailable },
      { status: 500, headers: NO_STORE }
    );
  }
}
