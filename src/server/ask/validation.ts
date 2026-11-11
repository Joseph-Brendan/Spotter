import "server-only";
import { z } from "zod";

/**
 * Body schema for POST /api/chat.
 *
 * Unknown keys are ignored, not rejected. rules/privacy.md rule 2: a member ID
 * in the request body is ignored, and the session is the only source of
 * identity. Ignoring is the documented behaviour; rejecting would change it.
 */
export const chatRequestSchema = z.object({
  // 500 is the working limit from docs/spotter-status-and-rag-plan.md. It is
  // still an inferred number and needs the owner's confirmation.
  message: z.string().trim().min(1).max(500),
});

export type ChatRequestPayload = z.infer<typeof chatRequestSchema>;
