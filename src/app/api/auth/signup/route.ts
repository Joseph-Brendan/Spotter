import { NextResponse } from "next/server";
import { signUpMember } from "@/server/auth/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await signUpMember(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, session: result.session });
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }
}
