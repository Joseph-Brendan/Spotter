import { NextResponse } from "next/server";
import { processPaymentWebhook, type WebhookPayload } from "@/server/payments/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("verif-hash");
    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ status: "failed" }, { status: 400 });
    }

    const result = await processPaymentWebhook(
      signature,
      body as WebhookPayload
    );

    return NextResponse.json(
      { status: result.success ? "success" : "failed" },
      { status: result.status }
    );
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
