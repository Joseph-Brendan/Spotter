import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StaffDashboard from "@/components/staff/staff-dashboard";
import { PERMISSIONS } from "@/lib/permissions";
import { staffCan } from "@/server/auth/authorization";
import { getStaffSession } from "@/server/auth/session";
import { getMembershipManagementData } from "@/server/membership/management";
import { getLatestReservation } from "@/server/membership/member-numbers";

export const metadata: Metadata = {
  title: "Reception desk",
};

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await getStaffSession();

  if (!session || !staffCan(session, PERMISSIONS.STAFF_DASHBOARD_ACCESS)) {
    redirect("/staff/login");
  }

  const canManageMembership = staffCan(
    session,
    PERMISSIONS.MEMBERSHIP_MANAGE
  );
  const [latest, membershipManagement] = await Promise.all([
    getLatestReservation({
      gymId: session.gymId,
      staffId: session.staffId,
    }),
    canManageMembership
      ? getMembershipManagementData(session.gymId)
      : Promise.resolve(null),
  ]);

  return (
    <StaffDashboard
      staff={{ name: session.name, role: session.role }}
      latestMemberNumber={latest?.memberNumber ?? null}
      membershipManagement={membershipManagement}
    />
  );
}
