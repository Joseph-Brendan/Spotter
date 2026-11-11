import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// The redirect is only a hint. It never confirms anything; it brings the
// member back to the dashboard, which asks the server to verify with the
// gateway.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const appUrl = env.APP_URL || "http://localhost:3000";
  const outcome = status === "cancelled" ? "cancelled" : "return";

  return NextResponse.redirect(new URL(`/?payment=${outcome}`, appUrl));
}
