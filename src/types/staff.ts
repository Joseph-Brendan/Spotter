import type { MemberTier, MembershipStatus } from "@/types/member";

export interface StaffLoginActionState {
  error?: string;
}

export interface ReserveMemberNumberActionState {
  status: "idle" | "success" | "error";
  memberNumber?: string;
  emailSent?: boolean;
  error?: string;
}

export interface StaffMembershipPlan {
  tier: "BASIC" | "PREMIUM" | "DIAMOND";
  priceKobo: number;
  durationDays: number;
}

export interface StaffMemberNumberReservation {
  memberNumber: string;
  email?: string | null;
  createdAt: string;
  claimedAt: string | null;
}

export interface StaffMemberNumberPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface SaveMembershipPlanActionState {
  status: "idle" | "success" | "error";
  message?: string;
  error?: string;
}

export interface OwnerMemberProfile {
  memberNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: MemberTier | null;
  status: MembershipStatus;
  expiryDate: string | null;
  registeredAt: string | null;
  checkInsTotal: number;
  checkInsThisMonth: number;
  lastCheckInAt: string | null;
  gymTimezone: string;
  lastPayment: {
    tier: MemberTier;
    amountKobo: number;
    durationDays: number;
    paidAt: string;
  } | null;
}

export type MembershipPlansActionState =
  | { status: "success"; plans: StaffMembershipPlan[] }
  | { status: "error"; error: string };

export interface MemberDetailsActionState {
  status: "idle" | "success" | "error";
  profile?: OwnerMemberProfile;
  error?: string;
}
