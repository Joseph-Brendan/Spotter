import { NextResponse } from "next/server";
import { copy } from "@/lib/copy";
import { getMemberSession } from "@/server/auth/session";
import { reconcileMemberPayment } from "@/server/payments/reconcile";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await getMemberSession();

    if (!session) {
      return NextResponse.json(
        { error: copy.payments.signInRequired },
        { status: 401 }
      );
    }

    if (session.mustChangePassword) {
      return NextResponse.json(
        { error: copy.tempPassword.prompt },
        { status: 403 }
      );
    }

    const state = await reconcileMemberPayment(session.memberId);

    return NextResponse.json(
      { state },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(
      "[payments/status] Payment check failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ state: "pending" }, { status: 500 });
  }
}
