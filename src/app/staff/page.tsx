import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StaffDashboard from "@/components/staff/staff-dashboard";
import StaffDashboardSkeleton from "@/components/staff/staff-dashboard-skeleton";
import { PERMISSIONS } from "@/lib/permissions";
import { staffCan } from "@/server/auth/authorization";
import { getStaffSession } from "@/server/auth/session";
import { listMemberNumberReservations } from "@/server/membership/member-numbers";
import type { StaffSessionData } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Reception desk",
};

export const dynamic = "force-dynamic";

interface StaffPageProps {
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
  }>;
}

function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return 1;
  }

  const page = Number(raw);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseSearchParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;

  return raw ? raw.trim().slice(0, 100) : "";
}

interface StaffDashboardSectionProps {
  session: StaffSessionData;
  page: number;
  search: string;
}

async function StaffDashboardSection({
  session,
  page,
  search,
}: StaffDashboardSectionProps) {
  const memberNumberList = await listMemberNumberReservations({
    gymId: session.gymId,
    staffId: session.staffId,
    page,
    search,
    includeEmail: session.role === "OWNER",
  });

  return (
    <StaffDashboard
      staff={{ name: session.name, role: session.role }}
      memberNumbers={memberNumberList.reservations}
      memberNumberPagination={memberNumberList.pagination}
      memberNumberSearchQuery={search}
      gymTimezone={memberNumberList.timezone}
      canManagePlans={session.role === "OWNER"}
    />
  );
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const session = await getStaffSession();

  if (!session || !staffCan(session, PERMISSIONS.STAFF_DASHBOARD_ACCESS)) {
    redirect("/staff/login");
  }

  const { page: pageParam, q: searchParam } = await searchParams;
  const requestedPage = parsePageParam(pageParam);
  const searchQuery = parseSearchParam(searchParam);

  // The shell streams immediately; the table arrives when its data does.
  return (
    <Suspense fallback={<StaffDashboardSkeleton />}>
      <StaffDashboardSection
        session={session}
        page={requestedPage}
        search={searchQuery}
      />
    </Suspense>
  );
}
