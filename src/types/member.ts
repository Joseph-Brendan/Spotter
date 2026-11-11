export type MembershipStatus =
  | "new"
  | "active"
  | "grace"
  | "expired"
  | "cancelled";
export type MemberTier = "BASIC" | "PREMIUM" | "DIAMOND";

export interface MembershipPlanSummary {
  tier: MemberTier;
  priceKobo: number;
  durationDays: number;
}

export interface MemberBillingSummary {
  status: MembershipStatus;
  storedTier: MemberTier | null;
  effectiveTier: MemberTier;
  expiryDate: string | null;
  gymTimezone: string;
  daysTrainedThisMonth: number;
  checkedInToday: boolean;
  balanceKobo: number;
  fetchedAt: string;
  plan: MembershipPlanSummary | null;
  availablePlans: MembershipPlanSummary[];
}
