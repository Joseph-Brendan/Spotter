import { after, NextResponse } from "next/server";
import { copy } from "@/lib/copy";
import { getMemberSession } from "@/server/auth/session";
import { generateCheckInCode } from "@/server/checkin/generate";
import { checkInQrSvg } from "@/server/checkin/qr";
import { sendCheckInCodeEmail } from "@/server/email/checkin-code-email";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

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

    const result = await generateCheckInCode(session.memberId);

    if (result.status !== "created" && result.status !== "existing") {
      return NextResponse.json({ status: result.status }, { headers: NO_STORE });
    }

    // The code is on her screen before the email leaves, so a slow mail relay
    // never slows the tap.
    if (result.status === "created" && session.email) {
      const { memberId, email, name } = session;

      after(async () => {
        try {
          await sendCheckInCodeEmail({
            to: email,
            name,
            digits: result.code,
            createdAt: result.createdAt,
            expiresAt: result.expiresAt,
            timeZone: result.gymTimezone,
          });
        } catch (error) {
          console.error(
            "[checkin/generate] Check in email failed for member",
            memberId,
            error instanceof Error ? error.message : error
          );
        }
      });
    }

    // The QR is a convenience. If it cannot be drawn, the digits still go out.
    const qrSvg = await checkInQrSvg(result.code).catch(() => null);

    return NextResponse.json(
      {
        status: result.status,
        code: result.code,
        expiresAt: result.expiresAt.toISOString(),
        emailed: Boolean(session.email),
        qrSvg,
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error(
      "[checkin/generate] Generation failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: copy.checkin.generateFailed },
      { status: 500, headers: NO_STORE }
    );
  }
}
