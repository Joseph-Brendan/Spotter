import "server-only";

import { generateUngrounded } from "@/server/ai/gemini";
import { checkNeverAnswer, type RefusalCategory } from "@/server/router/rules";
import { takeModelAllowance } from "@/server/ask/rate-limit";

/**
 * PROTOTYPE. One question, one ungrounded model answer.
 *
 * This is not the ask pipeline. It does no retrieval, applies no tier filter,
 * writes no QuestionLog row, skips the grounding check and ignores the thirty
 * card gate. It is wired only so the dashboard chat field can reach the model
 * while the pipeline is built.
 *
 * The never answer check still runs first. It costs nothing and it is the one
 * boundary the prototype does not move.
 *
 * Replaced by src/server/ask/answer-question.ts. Delete this file with it.
 */

const PROTOTYPE_SYSTEM_PROMPT = [
  "You are a temporary prototype inside a gym member app.",
  "You cannot see the gym's records.",
  "Never state or estimate a gym fact: no prices, opening hours, timetable,",
  "policies, balances, expiry dates, trainer names or whether a door will open.",
  "If the question needs one of those, say that you cannot check the gym's",
  "records yet.",
  "Answer in at most three short sentences and do not invent details.",
].join(" ");

export type PrototypeReply =
  | { kind: "answered"; reply: string }
  | { kind: "refused"; category: RefusalCategory }
  | { kind: "rate_limited"; retryAfterSeconds: number };

export async function answerPrototypeQuestion(input: {
  memberId: string;
  question: string;
  selfName: string | null;
}): Promise<PrototypeReply> {
  const refusal = checkNeverAnswer({
    question: input.question,
    selfName: input.selfName,
    // The hourly member-name loader is not built yet, so named-member
    // detection is limited to the generic phrasings. rules/ai.md expects the
    // full list before launch.
    memberNames: [],
  });

  if (refusal) {
    return { kind: "refused", category: refusal.category };
  }

  // Checked after the refusal, so a question the app will not answer never
  // spends the member's allowance. Only a call that could reach the model
  // counts.
  const allowance = takeModelAllowance(input.memberId);

  if (!allowance.allowed) {
    return {
      kind: "rate_limited",
      retryAfterSeconds: allowance.retryAfterSeconds,
    };
  }

  const reply = await generateUngrounded({
    system: PROTOTYPE_SYSTEM_PROMPT,
    input: input.question,
  });

  return { kind: "answered", reply };
}
