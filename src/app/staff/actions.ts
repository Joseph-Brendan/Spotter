"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { copy } from "@/lib/copy";
import { parseNairaToKobo } from "@/lib/money";
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
import { upsertMembershipPlan } from "@/server/membership/plans";
import type {
  ReserveMemberNumberActionState,
  SaveMembershipPlanActionState,
  StaffLoginActionState,
} from "@/types/staff";

function requestIp(headerStore: Headers): string | undefined {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
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

export async function saveMembershipPlanAction(
  previousState: SaveMembershipPlanActionState,
  formData: FormData
): Promise<SaveMembershipPlanActionState> {
  void previousState;

  const session = await getStaffSession();

  if (!session) {
    redirect("/staff/login");
  }

  if (session.role !== "OWNER") {
    return { status: "error", error: copy.staff.noPermission };
  }

  const tier = formData.get("tier");

  if (tier !== "BASIC" && tier !== "PREMIUM" && tier !== "DIAMOND") {
    return { status: "error", error: copy.staff.planFailed };
  }

  const priceInput = formData.get("price");
  const priceKobo =
    typeof priceInput === "string" ? parseNairaToKobo(priceInput) : null;

  if (priceKobo === null || priceKobo <= 0) {
    return { status: "error", error: copy.staff.planPriceInvalid };
  }

  const durationInput = formData.get("durationDays");
  const durationDays =
    typeof durationInput === "string" ? Number(durationInput) : NaN;

  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    return { status: "error", error: copy.staff.planDurationInvalid };
  }

  try {
    await upsertMembershipPlan({
      gymId: session.gymId,
      tier,
      priceKobo,
      durationDays,
    });
    revalidatePath("/staff");
    return { status: "success", message: copy.staff.planSaved };
  } catch (error) {
    console.error("Failed to save plan:", error);
    return { status: "error", error: copy.staff.planFailed };
  }
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
