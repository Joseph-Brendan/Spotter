import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";

/**
 * The one module that talks to the model provider.
 *
 * rules/ai.md requires every model call to pass through a single interface so
 * the provider can be swapped without touching the router or the answer. This
 * file is that seam: nothing else imports @google/genai.
 */

// Verified against the provider on 2026-11-10 with the real key, answer stage,
// on a normal question:
// - gemini-2.5-flash: 404, no longer available to new users.
// - gemini-3.8-flash: 504 DEADLINE_EXCEEDED.
// - gemini-3.6-flash: 7.4 s, over the 5 s answer budget in rules/ai.md.
// - gemini-3.5-flash-lite: 2.1 s to 5.7 s, sometimes over.
// - gemini-3.1-flash-lite: 0.8 s to 3.4 s over four runs, inside the budget.
// Recheck before launch; a slow model produces the error state, not a wrong
// answer, but it still fails the member.
const TEXT_MODEL = "gemini-3.1-flash-lite";

// Prototype only. See generateUngrounded.
const PROTOTYPE_TIMEOUT_MS = 9_000;

// rules/ai.md stage budgets. The vector query budget is not a model call and
// belongs with the query, not here.
export type ModelStage = "router" | "answer";

const STAGE_TIMEOUT_MS: Record<ModelStage, number> = {
  router: 3_000,
  answer: 5_000,
};

export type ModelFailure =
  | "not_configured"
  | "timeout"
  | "rate_limited"
  | "provider_error"
  | "empty_response"
  | "no_sources";

/**
 * A failed model call, classified so the caller can choose the member facing
 * state without inspecting the provider's error shape.
 *
 * The message never carries the prompt, the answer or the API key. Provider
 * messages are not reused because a validation error can echo the request.
 */
export class ModelError extends Error {
  readonly stage: ModelStage;
  readonly failure: ModelFailure;
  readonly status?: number;

  constructor(
    stage: ModelStage,
    failure: ModelFailure,
    message: string,
    status?: number
  ) {
    super(message);
    this.name = "ModelError";
    this.stage = stage;
    this.failure = failure;
    this.status = status;
  }
}

export interface Prompt {
  /** The canonical prompt text from src/server/ai/prompts/. Never paraphrased. */
  system: string;
  /** The member's question, or the assembled context and question. */
  input: string;
}

let client: GoogleGenAI | null = null;

function getClient(stage: ModelStage): GoogleGenAI {
  if (client) {
    return client;
  }

  if (!env.GEMINI_API_KEY) {
    throw new ModelError(
      stage,
      "not_configured",
      "GEMINI_API_KEY is not configured. See rules/env.md and .env.example."
    );
  }

  client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  return client;
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function asModelError(
  error: unknown,
  stage: ModelStage,
  timeoutMs: number
): ModelError {
  if (error instanceof ModelError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status === 429) {
      return new ModelError(
        stage,
        "rate_limited",
        `The ${stage} model call hit the provider rate limit. rules/ai.md forbids falling back to a cached or generic answer.`,
        error.status
      );
    }

    return new ModelError(
      stage,
      "provider_error",
      `The ${stage} model call failed with status ${error.status}.`,
      error.status
    );
  }

  if (isTimeout(error)) {
    return new ModelError(
      stage,
      "timeout",
      `The ${stage} model call exceeded its ${timeoutMs} ms budget.`
    );
  }

  return new ModelError(
    stage,
    "provider_error",
    `The ${stage} model call failed before a response arrived.`
  );
}

async function generate(
  stage: ModelStage,
  prompt: Prompt,
  options: { responseMimeType?: "application/json"; timeoutMs?: number } = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? STAGE_TIMEOUT_MS[stage];

  try {
    const response = await getClient(stage).models.generateContent({
      model: TEXT_MODEL,
      contents: prompt.input,
      config: {
        systemInstruction: prompt.system,
        // rules/ai.md: temperature is zero on both calls.
        temperature: 0,
        // The budget is a local abort only. The provider rejects a request
        // deadline below ten seconds with 400 INVALID_ARGUMENT ("Manually set
        // deadline 5s is too short"), and every stage budget here is under
        // that floor. Sending httpOptions.timeout turns a budget into a
        // guaranteed failure, so do not add it back.
        abortSignal: AbortSignal.timeout(timeoutMs),
        ...(options.responseMimeType
          ? { responseMimeType: options.responseMimeType }
          : {}),
      },
    });

    const text = response.text?.trim();

    if (!text) {
      throw new ModelError(
        stage,
        "empty_response",
        `The ${stage} model returned no text.`
      );
    }

    return text;
  } catch (error) {
    throw asModelError(error, stage, timeoutMs);
  }
}

function isRetryable(error: ModelError): boolean {
  if (error.failure === "timeout") {
    return true;
  }

  // A network failure surfaces with no status. A 4xx will fail the same way
  // twice and only spends the member's time.
  return (
    error.failure === "provider_error" &&
    (error.status === undefined || error.status >= 500)
  );
}

async function retryOnce(
  stage: ModelStage,
  attempt: () => Promise<string>
): Promise<string> {
  try {
    return await attempt();
  } catch (error) {
    const failure = asModelError(error, stage, STAGE_TIMEOUT_MS[stage]);

    if (!isRetryable(failure)) {
      throw failure;
    }

    return attempt();
  }
}

/**
 * The router call. JSON output only, temperature zero, one retry.
 *
 * The returned text is unparsed on purpose: rules/ai.md owns the parse, the
 * one code fence strip and the error outcome when it still fails.
 */
export async function generateJson(prompt: Prompt): Promise<string> {
  return retryOnce("router", () =>
    generate("router", prompt, { responseMimeType: "application/json" })
  );
}

/**
 * The answer call. Plain text, temperature zero, no retry.
 *
 * Source records are a parameter so the call is impossible to write without
 * them. AGENTS.md: never call the answer model without source records, return
 * the refusal instead.
 */
export async function generateText(
  prompt: Prompt,
  sources: readonly string[]
): Promise<string> {
  if (sources.length === 0) {
    throw new ModelError(
      "answer",
      "no_sources",
      "The answer model was called with no source records. Return the refusal instead."
    );
  }

  return generate("answer", prompt);
}

/**
 * PROTOTYPE ONLY. Never use this for a member-facing answer.
 *
 * AGENTS.md forbids calling the answer model without source records, and this
 * function does exactly that. It exists because the owner asked for a temporary
 * chat prototype before retrieval was built. The name is deliberate: no future
 * reader should mistake it for the grounded path.
 *
 * Delete this function, and src/app/api/chat/route.ts, when the ask pipeline
 * lands. Do not call it from the router or the ask module.
 */
export async function generateUngrounded(prompt: Prompt): Promise<string> {
  // The real answer path keeps its 5 s budget from rules/ai.md. The prototype
  // gets 9 s because the provider's free tier measured 0.8 s to 5.7 s for the
  // same request, and a 5 s abort failed one run in five. Nine seconds still
  // sits under the 11 s ceiling. This override does not belong on the grounded
  // path.
  return generate("answer", prompt, { timeoutMs: PROTOTYPE_TIMEOUT_MS });
}

/**
 * OPEN: embeddings are not wired here yet.
 *
 * PRD section 7.1 names `text-embedding-004` at 768 dimensions. That model was
 * shut down in January 2026. The owner chose `gemini-embedding-2` at 768
 * dimensions on 2026-11-10, because the chunk column is already
 * `vector(768)`. It is not added until retrieval exists: that change also edits
 * rules/retrieval.md, so the model and the rules land together.
 */
