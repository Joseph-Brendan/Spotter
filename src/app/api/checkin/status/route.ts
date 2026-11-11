import { NextResponse } from "next/server";
import { copy } from "@/lib/copy";
import { getMemberSession } from "@/server/auth/session";
import { getCheckInCodeState } from "@/server/checkin/status";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const session = await getMemberSession();

    if (!session) {
      return NextResponse.json(
        { error: copy.payments.signInRequired },
        { status: 401, headers: NO_STORE }
      );
    }

    const state = await getCheckInCodeState(session.memberId);

    return NextResponse.json({ state }, { headers: NO_STORE });
  } catch (error) {
    console.error(
      "[checkin/status] Status check failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: copy.checkin.stillConfirming },
      { status: 500, headers: NO_STORE }
    );
  }
}
