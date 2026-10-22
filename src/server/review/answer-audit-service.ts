import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { WeeklyAuditQuestionItem } from "./types";

export interface AuditSubmissionInput {
  questionLogId: string;
  auditedById: string;
  verdict: "CORRECT" | "WRONG";
}

export interface AuditSubmissionResult {
  success: boolean;
  auditId?: string;
  questionLogId?: string;
  verdict?: "CORRECT" | "WRONG";
  auditedAt?: string;
  auditorName?: string;
  error?: string;
}

/**
 * Pulls a random sample of up to exactly 20 answered questions for the Weekly Answer Audit.
 * Includes existing audit status if already reviewed.
 */
export async function getAnswerAuditSample(
  limit = 20,
  gymId?: string
): Promise<WeeklyAuditQuestionItem[]> {
  try {
    const gymCondition = gymId
      ? Prisma.sql`AND m."gymId" = ${gymId}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        question: string;
        answerText: string | null;
        cardTitle: string | null;
        memberNumber: string;
        askedAt: Date;
        latestAuditId: string | null;
        latestVerdict: "CORRECT" | "WRONG" | null;
        latestAuditedAt: Date | null;
        auditorName: string | null;
      }>
    >`
      SELECT
        q.id,
        q.question,
        q."answerText",
        c.title AS "cardTitle",
        m."memberNumber",
        q."askedAt",
        a.id AS "latestAuditId",
        a.verdict AS "latestVerdict",
        a."auditedAt" AS "latestAuditedAt",
        s.name AS "auditorName"
      FROM "QuestionLog" q
      JOIN "Member" m ON q."memberId" = m.id
      LEFT JOIN "Card" c ON q."cardId" = c.id
      LEFT JOIN LATERAL (
        SELECT id, verdict, "auditedAt", "auditedById"
        FROM "AnswerAudit"
        WHERE "questionLogId" = q.id
        ORDER BY "auditedAt" DESC
        LIMIT 1
      ) a ON true
      LEFT JOIN "Staff" s ON a."auditedById" = s.id
      WHERE q.outcome = 'ANSWERED'
      ${gymCondition}
      ORDER BY RANDOM()
      LIMIT ${limit};
    `;

    return rows.map((r) => ({
      id: r.id,
      question: r.question,
      answerText: r.answerText,
      cardTitle: r.cardTitle,
      memberNumber: r.memberNumber,
      askedAt:
        r.askedAt instanceof Date ? r.askedAt.toISOString() : String(r.askedAt),
      latestAudit: r.latestAuditId
        ? {
            id: r.latestAuditId,
            verdict: r.latestVerdict!,
            auditedAt:
              r.latestAuditedAt instanceof Date
                ? r.latestAuditedAt.toISOString()
                : String(r.latestAuditedAt),
            auditorName: r.auditorName ?? "Unknown Auditor",
          }
        : null,
    }));
  } catch (error) {
    console.error("Failed to fetch answer audit sample via SQL, falling back to ORM:", error);

    // Fallback via Prisma standard findMany
    const questions = await prisma.questionLog.findMany({
      where: {
        outcome: "ANSWERED",
        ...(gymId ? { member: { gymId } } : {}),
      },
      include: {
        card: { select: { title: true } },
        member: { select: { memberNumber: true } },
        audits: {
          orderBy: { auditedAt: "desc" },
          take: 1,
          include: {
            auditedBy: { select: { name: true } },
          },
        },
      },
      take: 100,
    });

    // Shuffle and pick 20
    const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, limit);

    return shuffled.map((q) => {
      const latest = q.audits[0];
      return {
        id: q.id,
        question: q.question,
        answerText: q.answerText,
        cardTitle: q.card?.title ?? null,
        memberNumber: q.member.memberNumber,
        askedAt: q.askedAt.toISOString(),
        latestAudit: latest
          ? {
              id: latest.id,
              verdict: latest.verdict,
              auditedAt: latest.auditedAt.toISOString(),
              auditorName: latest.auditedBy.name,
            }
          : null,
      };
    });
  }
}

/**
 * Records an audit decision for a question in the AnswerAudit table.
 * Accurately logs the auditor's staff user ID, verdict, and precise timestamp.
 */
export async function submitAnswerAudit(
  input: AuditSubmissionInput
): Promise<AuditSubmissionResult> {
  const { questionLogId, auditedById, verdict } = input;

  if (!questionLogId || !auditedById || !verdict) {
    return { success: false, error: "Missing required audit fields." };
  }

  if (verdict !== "CORRECT" && verdict !== "WRONG") {
    return { success: false, error: "Invalid audit verdict." };
  }

  try {
    const question = await prisma.questionLog.findUnique({
      where: { id: questionLogId },
    });

    if (!question) {
      return { success: false, error: "Question log not found." };
    }

    const auditor = await prisma.staff.findUnique({
      where: { id: auditedById },
      select: { name: true },
    });

    if (!auditor) {
      return { success: false, error: "Auditor staff record not found." };
    }

    const recordedAudit = await prisma.answerAudit.create({
      data: {
        questionLogId,
        auditedById,
        verdict,
        auditedAt: new Date(),
      },
    });

    return {
      success: true,
      auditId: recordedAudit.id,
      questionLogId: recordedAudit.questionLogId,
      verdict: recordedAudit.verdict,
      auditedAt: recordedAudit.auditedAt.toISOString(),
      auditorName: auditor.name,
    };
  } catch (error) {
    console.error("Failed to record answer audit:", error);
    return { success: false, error: "Failed to persist audit decision." };
  }
}
