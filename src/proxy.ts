import { NextResponse, type NextRequest } from "next/server";
import {
  getMemberSessionFromRequest,
  getStaffSessionFromRequest,
} from "@/server/auth/session";

const STAFF_PUBLIC_PATHS = new Set(["/staff/login"]);

function isStaffOrOwnerPath(pathname: string): boolean {
  return (
    pathname === "/staff" ||
    pathname.startsWith("/staff/") ||
    pathname === "/owner" ||
    pathname.startsWith("/owner/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.delete("x-member-id");
  headers.delete("x-member-name");
  headers.delete("x-staff-id");
  headers.delete("x-staff-role");

  if (isStaffOrOwnerPath(pathname)) {
    const staffSession = await getStaffSessionFromRequest(request);

    if (!staffSession && !STAFF_PUBLIC_PATHS.has(pathname)) {
      const redirectUrl = new URL("/staff/login", request.url);
      if (pathname !== "/staff") {
        redirectUrl.searchParams.set("redirect", pathname);
      }
      return NextResponse.redirect(redirectUrl);
    }

    if (staffSession) {
      headers.set("x-staff-id", staffSession.staffId);
      headers.set("x-staff-role", staffSession.role);
    }

    return NextResponse.next({ request: { headers } });
  }

  const session = await getMemberSessionFromRequest(request);

  if (session) {
    headers.set("x-member-id", session.memberId);
    headers.set("x-member-name", encodeURIComponent(session.name));
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
