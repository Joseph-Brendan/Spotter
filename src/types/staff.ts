export interface StaffLoginActionState {
  error?: string;
}

export interface ReserveMemberNumberActionState {
  status: "idle" | "success" | "error";
  memberNumber?: string;
  emailSent?: boolean;
  error?: string;
}

export interface ManagementActionState {
  status: "idle" | "success" | "error";
  message?: string;
  error?: string;
}

export interface ManagedMember {
  id: string;
  name: string;
  memberNumber: string;
  phone: string;
  tier: "BASIC" | "PREMIUM";
  expiryDate: string;
  openingBalanceKobo: number;
  hasAccount: boolean;
}

export interface ManagedMembershipPlan {
  id: string;
  tier: "BASIC" | "PREMIUM";
  priceKobo: number;
  durationDays: number;
}

export interface MembershipManagementData {
  members: ManagedMember[];
  plans: ManagedMembershipPlan[];
}
