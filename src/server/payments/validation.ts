import "server-only";
import { z } from "zod";

export const initiatePaymentSchema = z.object({
  purpose: z.enum(["RENEWAL", "ARREARS"]),
  tier: z.enum(["BASIC", "PREMIUM", "DIAMOND"]),
  idempotencyKey: z.string().trim().min(16).max(128),
  password: z.string().trim().min(1).optional(),
});
