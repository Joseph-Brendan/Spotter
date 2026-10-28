import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  if (status === "successful" || status === "completed") {
    return NextResponse.redirect(new URL("/?payment=success", request.url));
  }

  return NextResponse.redirect(new URL("/?payment=cancelled", request.url));
}
