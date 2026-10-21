"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { copy } from "@/lib/copy";
import { PERMISSIONS } from "@/lib/permissions";
import { staffCan } from "@/server/auth/authorization";
import { getStaffSession } from "@/server/auth/session";
import { loginStaff, logoutStaff } from "@/server/auth/staff-service";
import {
  reserveMemberNumberSchema,
  staffLoginSchema,
} from "@/server/auth/validation";
import { sendMemberNumberEmail } from "@/server/email/member-number-email";
import { reserveMemberNumber } from "@/server/membership/member-numbers";
import {
  createMemberRecord,
  createMembershipPlan,
  MembershipManagementError,
  updateMemberRecord,
  updateMembershipPlan,
} from "@/server/membership/management";
import {
  createMemberSchema,
  createMembershipPlanSchema,
  updateMemberSchema,
  updateMembershipPlanSchema,
} from "@/server/membership/validation";
import type {
  ManagementActionState,
  ReserveMemberNumberActionState,
  StaffLoginActionState,
} from "@/types/staff";

function requestIp(headerStore: Headers): string | undefined {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}

async function requireMembershipManager(): Promise<
  | { gymId: string; staffId: string }
  | ManagementActionState
> {
  const session = await getStaffSession();

  if (!session) {
    redirect("/staff/login");
  }

  if (!staffCan(session, PERMISSIONS.MEMBERSHIP_MANAGE)) {
    return { status: "error", error: copy.staff.noPermission };
  }

  return { gymId: session.gymId, staffId: session.staffId };
}

function managementError(error: unknown): string {
  if (error instanceof MembershipManagementError) {
    switch (error.code) {
      case "MEMBER_NUMBER_TAKEN":
        return copy.staff.memberNumberTaken;
      case "MEMBER_NOT_FOUND":
        return copy.staff.memberNotFound;
      case "PLAN_TIER_TAKEN":
        return copy.staff.planTierTaken;
      case "PLAN_NOT_FOUND":
        return copy.staff.planNotFound;
    }
  }

  return copy.staff.managementUnavailable;
}

export async function loginStaffAction(
  _previousState: StaffLoginActionState,
  formData: FormData
): Promise<StaffLoginActionState> {
  const parsed = staffLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: copy.staff.loginFailed };
  }

  let result;

  try {
    const headerStore = await headers();
    result = await loginStaff({
      ...parsed.data,
      ip: requestIp(headerStore),
    });
  } catch {
    return { error: copy.staff.signInUnavailable };
  }

  if (!result.success) {
    return { error: result.error ?? copy.staff.loginFailed };
  }

  redirect("/staff");
}

export async function logoutStaffAction(formData: FormData): Promise<void> {
  void formData;
  await logoutStaff();
  redirect("/staff/login");
}

export async function reserveMemberNumberAction(
  previousState: ReserveMemberNumberActionState,
  formData: FormData
): Promise<ReserveMemberNumberActionState> {
  void previousState;

  const session = await getStaffSession();

  if (!session) {
    redirect("/staff/login");
  }

  if (!staffCan(session, PERMISSIONS.MEMBER_NUMBER_RESERVE)) {
    return { status: "error", error: copy.staff.noPermission };
  }

  const parsed = reserveMemberNumberSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { status: "error", error: copy.validation.emailInvalid };
  }

  try {
    const result = await reserveMemberNumber({
      gymId: session.gymId,
      staffId: session.staffId,
      email: parsed.data.email,
    });

    if (!result.success || !result.memberNumber) {
      return { status: "error", error: copy.staff.reserveFailed };
    }

    let emailSent = true;

    try {
      await sendMemberNumberEmail({
        to: parsed.data.email,
        memberNumber: result.memberNumber,
      });
    } catch (error) {
      emailSent = false;
      console.error(
        "Member number email failed:",
        error instanceof Error ? error.name : "unknown"
      );
    }

    return {
      status: "success",
      memberNumber: result.memberNumber,
      emailSent,
    };
  } catch {
    return { status: "error", error: copy.staff.reserveUnavailable };
  }
}

export async function createMemberAction(
  previousState: ManagementActionState,
  formData: FormData
): Promise<ManagementActionState> {
  void previousState;
  const manager = await requireMembershipManager();

  if ("status" in manager) {
    return manager;
  }

  const parsed = createMemberSchema.safeParse({
    name: formData.get("name"),
    memberNumber: formData.get("memberNumber"),
    phone: formData.get("phone"),
    tier: formData.get("tier"),
    expiryDate: formData.get("expiryDate"),
    openingBalanceKobo: formData.get("openingBalanceKobo"),
  });

  if (!parsed.success) {
    return { status: "error", error: copy.staff.managementInvalid };
  }

  try {
    await createMemberRecord(manager.gymId, manager.staffId, parsed.data);
    revalidatePath("/staff");
    return { status: "success", message: copy.staff.memberCreated };
  } catch (error) {
    return { status: "error", error: managementError(error) };
  }
}

export async function updateMemberAction(
  previousState: ManagementActionState,
  formData: FormData
): Promise<ManagementActionState> {
  void previousState;
  const manager = await requireMembershipManager();

  if ("status" in manager) {
    return manager;
  }

  const parsed = updateMemberSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    memberNumber: formData.get("memberNumber"),
    phone: formData.get("phone"),
    tier: formData.get("tier"),
    expiryDate: formData.get("expiryDate"),
    openingBalanceKobo: formData.get("openingBalanceKobo"),
  });

  if (!parsed.success) {
    return { status: "error", error: copy.staff.managementInvalid };
  }

  try {
    await updateMemberRecord(manager.gymId, manager.staffId, parsed.data);
    revalidatePath("/staff");
    return { status: "success", message: copy.staff.memberUpdated };
  } catch (error) {
    return { status: "error", error: managementError(error) };
  }
}

export async function createMembershipPlanAction(
  previousState: ManagementActionState,
  formData: FormData
): Promise<ManagementActionState> {
  void previousState;
  const manager = await requireMembershipManager();

  if ("status" in manager) {
    return manager;
  }

  const parsed = createMembershipPlanSchema.safeParse({
    tier: formData.get("tier"),
    priceKobo: formData.get("priceKobo"),
    durationDays: formData.get("durationDays"),
  });

  if (!parsed.success) {
    return { status: "error", error: copy.staff.managementInvalid };
  }

  try {
    await createMembershipPlan(manager.gymId, parsed.data);
    revalidatePath("/staff");
    return { status: "success", message: copy.staff.planCreated };
  } catch (error) {
    return { status: "error", error: managementError(error) };
  }
}

export async function updateMembershipPlanAction(
  previousState: ManagementActionState,
  formData: FormData
): Promise<ManagementActionState> {
  void previousState;
  const manager = await requireMembershipManager();

  if ("status" in manager) {
    return manager;
  }

  const parsed = updateMembershipPlanSchema.safeParse({
    id: formData.get("id"),
    tier: formData.get("tier"),
    priceKobo: formData.get("priceKobo"),
    durationDays: formData.get("durationDays"),
  });

  if (!parsed.success) {
    return { status: "error", error: copy.staff.managementInvalid };
  }

  try {
    await updateMembershipPlan(manager.gymId, parsed.data);
    revalidatePath("/staff");
    return { status: "success", message: copy.staff.planUpdated };
  } catch (error) {
    return { status: "error", error: managementError(error) };
  }
}
