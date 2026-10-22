import { describe, expect, it, vi } from "vitest";
import { submitAnswerAudit } from "@/server/review/answer-audit-service";
import { prisma } from "@/server/db";

describe("submitAnswerAudit", () => {
  it("rejects invalid input with missing fields", async () => {
    const result = await submitAnswerAudit({
      questionLogId: "",
      auditedById: "staff-1",
      verdict: "CORRECT",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Missing required audit fields/);
  });

  it("rejects invalid verdict value", async () => {
    const result = await submitAnswerAudit({
      questionLogId: "q-1",
      auditedById: "staff-1",
      verdict: "INVALID_VERDICT" as unknown as "CORRECT",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid audit verdict/);
  });

  it("handles non-existent question log gracefully", async () => {
    vi.spyOn(prisma.questionLog, "findUnique").mockResolvedValueOnce(null);

    const result = await submitAnswerAudit({
      questionLogId: "non-existent-id",
      auditedById: "staff-1",
      verdict: "CORRECT",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Question log not found/);
  });

  it("records an audit decision accurately with auditor ID and timestamp", async () => {
    vi.spyOn(prisma.questionLog, "findUnique").mockResolvedValueOnce({
      id: "q-123",
      memberId: "m-1",
      question: "What are the gym hours?",
      intent: "SHARED_QUESTION",
      outcome: "ANSWERED",
      topScore: 0.92,
      cardId: "card-1",
      answerText: "The gym opens at 6:00 AM.",
      askedAt: new Date(),
    } as any);

    vi.spyOn(prisma.staff, "findUnique").mockResolvedValueOnce({
      name: "Owner Admin",
    } as any);

    const now = new Date();
    vi.spyOn(prisma.answerAudit, "create").mockResolvedValueOnce({
      id: "audit-abc",
      questionLogId: "q-123",
      auditedById: "staff-owner-1",
      verdict: "CORRECT",
      auditedAt: now,
    } as any);

    const result = await submitAnswerAudit({
      questionLogId: "q-123",
      auditedById: "staff-owner-1",
      verdict: "CORRECT",
    });

    expect(result.success).toBe(true);
    expect(result.auditId).toBe("audit-abc");
    expect(result.verdict).toBe("CORRECT");
    expect(result.auditorName).toBe("Owner Admin");
    expect(result.auditedAt).toBe(now.toISOString());
  });
});
