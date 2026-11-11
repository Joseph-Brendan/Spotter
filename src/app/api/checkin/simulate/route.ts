import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { clientIp } from "@/server/auth/rate-limit";
import { isKeypadBlocked, recordKeypadRefusal } from "@/server/checkin/keypad-limit";
import { verifyCheckInCode } from "@/server/checkin/verifier";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

// The simulated door keypad. It exists only while CHECKIN_SIMULATED is the
// exact string "true", and it sends digits to the one verifier.
export async function POST(request: Request) {
  if (!env.CHECKIN_SIMULATED) {
    return new NextResponse(null, { status: 404 });
  }

  const ip = clientIp(request) ?? "unknown";

  if (isKeypadBlocked(ip)) {
    return NextResponse.json(
      { status: "blocked" },
      { status: 429, headers: NO_STORE }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    digits?: unknown;
    method?: unknown;
  } | null;
  const digits = typeof body?.digits === "string" ? body.digits.trim() : "";
  const consumedBy = body?.method === "qr" ? "SIMULATED_QR" : "SIMULATED";

  try {
    const result = await verifyCheckInCode(digits, consumedBy);

    if (result.status === "refused") {
      recordKeypadRefusal(ip);
    }

    return NextResponse.json({ status: result.status }, { headers: NO_STORE });
  } catch (error) {
    console.error(
      "[checkin/simulate] Verification failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { status: "error" },
      { status: 500, headers: NO_STORE }
    );
  }
}
