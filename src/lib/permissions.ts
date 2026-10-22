export const PERMISSIONS = {
  STAFF_DASHBOARD_ACCESS: "staff.dashboard.access",
  MEMBER_NUMBER_RESERVE: "member_number.reserve",
  OWNER_REVIEW_ACCESS: "owner.review.access",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
