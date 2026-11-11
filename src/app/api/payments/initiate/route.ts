import { NextResponse } from "next/server";
import { copy } from "@/lib/copy";
import { verifyMemberPassword } from "@/server/auth/service";
import { getMemberSession } from "@/server/auth/session";
import { initiateMemberPayment } from "@/server/payments/initiate";
import { initiatePaymentSchema } from "@/server/payments/validation";

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => null);
    const parsed = initiatePaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: copy.payments.failedToStart },
        { status: 400 }
      );
    }

    if (parsed.data.password) {
      const passwordMatches = await verifyMemberPassword(
        session.memberId,
        parsed.data.password
      );

      if (!passwordMatches) {
        return NextResponse.json(
          { error: copy.payments.passwordWrong },
          { status: 401 }
        );
      }
    }

    const result = await initiateMemberPayment({
      memberId: session.memberId,
      purpose: parsed.data.purpose,
      tier: parsed.data.tier,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    if (result.error === "QUOTE_NOT_FOUND") {
      return NextResponse.json(
        {
          error:
            parsed.data.purpose === "RENEWAL"
              ? copy.payments.planNotSet
              : copy.payments.nothingDue,
        },
        { status: 409 }
      );
    }

    if (result.error || !result.checkoutUrl) {
      return NextResponse.json(
        { error: copy.payments.failedToStart },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: result.checkoutUrl,
    });
  } catch (err) {
    console.error(
      "[initiate] Payment initiation failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: copy.payments.failedToStart },
      { status: 500 }
    );
  }
}
