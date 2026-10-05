import { NextResponse } from "next/server";
import { logoutMember, getCurrentMember } from "@/server/auth/service";

export async function POST() {
  await logoutMember();
  return NextResponse.json({ success: true });
}

export async function GET() {
  const member = await getCurrentMember();
  return NextResponse.json({ member });
}
