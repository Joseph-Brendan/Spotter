"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { copy } from "@/lib/copy";
import { env } from "@/lib/env";
import { parseNairaToKobo } from "@/lib/money";
import { PERMISSIONS } from "@/lib/permissions";
import { staffCan } from "@/server/auth/authorization";
import { getStaffSession } from "@/server/auth/session";
import { loginStaff, logoutStaff } from "@/server/auth/staff-service";
import {
  memberNumberSchema,
  reserveMemberNumberSchema,
  staffLoginSchema,
} from "@/server/auth/validation";
import { sendMemberNumberEmail } from "@/server/email/member-number-email";
import {
  findMemberIdByNumber,
  reserveMemberNumber,
} from "@/server/membership/member-numbers";
import {
  listMembershipPlans,
  upsertMembershipPlan,
} from "@/server/membership/plans";
import { getOwnerMemberProfile } from "@/server/private/member-profile";
import type {
  MemberDetailsActionState,
  MembershipPlansActionState,
  ReserveMemberNumberActionState,
  SaveMembershipPlanActionState,
  StaffLoginActionState,
} from "@/types/staff";

function requestIp(headerStore: Headers): string | undefined {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}

function logMemberNumberEmailError(error: unknown): void {
  if (typeof error !== "object" || error === null) {
    console.error(`Member number email failed: ${String(error)}`);
    return;
  }

  const mailError = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    command?: unknown;
    responseCode?: unknown;
    response?: unknown;
  };

  const details = [
    ["name", mailError.name],
    ["message", mailError.message],
    ["code", mailError.code],
    ["command", mailError.command],
    ["responseCode", mailError.responseCode],
    ["response", mailError.response],
  ]
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");

  console.error(`Member number email failed: ${details || String(error)}`);
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

export async function getMembershipPlansAction(): Promise<MembershipPlansActionState> {
  const session = await getStaffSession();

  if (!session) {
    redirect("/staff/login");
  }

  if (session.role !== "OWNER") {
    return { status: "error", error: copy.staff.noPermission };
  }

  try {
    const plans = await listMembershipPlans(session.gymId);
    return { status: "success", plans };
  } catch (error) {
    console.error("Failed to load plans:", error);
    return { status: "error", error: copy.staff.plansLoadError };
  }
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
    return { status: "success", message: copy.staff.planSaved };
  } catch (error) {
    console.error("Failed to save plan:", error);
    return { status: "error", error: copy.staff.planFailed };
  }
}

export async function getMemberDetailsAction(
  memberNumber: string
): Promise<MemberDetailsActionState> {
  const session = await getStaffSession();

  if (!session || session.role !== "OWNER") {
    return { status: "error", error: copy.staff.noPermission };
  }

  const parsed = memberNumberSchema.safeParse(memberNumber);

  if (!parsed.success) {
    return { status: "error", error: copy.staff.memberDetailsNotFound };
  }

  try {
    const memberId = await findMemberIdByNumber(session.gymId, parsed.data);

    if (!memberId) {
      return { status: "error", error: copy.staff.memberDetailsNotFound };
    }

    const profile = await getOwnerMemberProfile(memberId, {
      staffId: session.staffId,
      gymId: session.gymId,
      role: session.role,
    });

    if (!profile) {
      return { status: "error", error: copy.staff.memberDetailsUnavailable };
    }

    return { status: "success", profile };
  } catch {
    return { status: "error", error: copy.staff.memberDetailsError };
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

    const emailConfigured = Boolean(
      env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM
    );

    // Only a send that cannot start at all is reported to staff. With SMTP
    // configured, the send runs after the response so the button does not wait
    // on the mail server, and any delivery failure is logged.
    const memberNumber = result.memberNumber;

    if (emailConfigured) {
      after(async () => {
        try {
          await sendMemberNumberEmail({
            to: parsed.data.email,
            memberNumber,
          });
        } catch (error) {
          logMemberNumberEmailError(error);
        }
      });
    }

    return {
      status: "success",
      memberNumber: result.memberNumber,
      emailSent: emailConfigured,
    };
  } catch {
    return { status: "error", error: copy.staff.reserveUnavailable };
  }
}
