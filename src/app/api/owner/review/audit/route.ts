import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { staffCan } from "@/server/auth/authorization";
import { getStaffSession } from "@/server/auth/session";
import {
  getAnswerAuditSample,
  submitAnswerAudit,
} from "@/server/review/answer-audit-service";

const auditSubmissionSchema = z.object({
  questionLogId: z.string().min(1, "Question Log ID is required"),
  verdict: z.enum(["CORRECT", "WRONG"]),
});

export async function GET() {
  const session = await getStaffSession();

  if (
    !session ||
    (session.role !== "OWNER" && !staffCan(session, PERMISSIONS.OWNER_REVIEW_ACCESS))
  ) {
    return NextResponse.json(
      { error: "Forbidden: Owner or Audit access required." },
      { status: 403 }
    );
  }

  const sample = await getAnswerAuditSample(20, session.gymId);

  return NextResponse.json({
    success: true,
    sample,
  });
}

export async function POST(request: Request) {
  const session = await getStaffSession();

  if (
    !session ||
    (session.role !== "OWNER" && !staffCan(session, PERMISSIONS.OWNER_REVIEW_ACCESS))
  ) {
    return NextResponse.json(
      { error: "Forbidden: Owner or Audit access required." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = auditSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid audit payload." },
      { status: 400 }
    );
  }

  const result = await submitAnswerAudit({
    questionLogId: parsed.data.questionLogId,
    auditedById: session.staffId,
    verdict: parsed.data.verdict,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
