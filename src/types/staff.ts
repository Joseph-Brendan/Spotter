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

export interface SaveMembershipPlanActionState {
  status: "idle" | "success" | "error";
  message?: string;
  error?: string;
}
