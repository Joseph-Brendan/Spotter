/**
 * Fixed member-facing copy per rules/copy.md.
 * No member-facing string should be written inline in components.
 */
export const copy = {
  refusals: {
    records: "I do not have that in the gym's records.",
    medical: (name: string) =>
      `I cannot answer questions about injuries or health. Please speak to ${name} or your doctor.`,
    door: (name: string) =>
      `I cannot tell you whether the door will open. Please speak to ${name}.`,
  },
  money: {
    outstanding: (amount: string, date: string) =>
      `Our records show ${amount} outstanding for ${date}.`,
    framing: (date: string) =>
      `Correct as of ${date}, based on payments recorded here.`,
  },
  stale: {
    openToRefresh: "Open to refresh",
  },
  empty: {
    noCheckIns: (date: string) => `No check ins recorded for ${date}.`,
    noPayments:
      "No payments recorded yet. Ask the front desk if you paid in cash.",
    zeroDaysThisMonth: "0 days this month",
  },
  signup: {
    enterMemberNumber: "Enter the member number on your gym card.",
    memberNumberNotFound:
      "We could not find that member number. Check it with the front desk.",
    memberNumberAlreadyHasAccount:
      "That member number already has an account. Ask the front desk for help.",
    emailAlreadyRegistered: "That email is already registered.",
    passwordMinLength: "Use at least eight characters.",
  },
  login: {
    failed: "That email and password do not match.",
    lockout: "Too many attempts. Try again in fifteen minutes.",
  },
  tempPassword: {
    prompt: "Set a new password to continue.",
    expired:
      "That temporary password has expired. Ask the front desk for a new one.",
    deskNotice:
      "Ask the front desk for a temporary password to reset your account.",
    success: "Password changed. You can now log in.",
  },
  checkin: {
    typeCode: "Type this code at the door",
    expiresIn: (seconds: number | string) => `Expires in ${seconds} seconds`,
    checkingIn: "Checking you in",
    checkedIn: "Checked in",
    codeExpired: "That code expired. Tap to get a new one.",
    alreadyCheckedIn: "You are already checked in today",
    gymClosed: "The gym is closed right now. Check in when it opens.",
    renewToCheckIn: "Renew to check in",
    stillConfirming: "Still confirming. Keep this screen open.",
  },
  payments: {
    confirming: (amount: string, date: string) =>
      `We are confirming a payment of ${amount} from ${date}.`,
    nothingDue: "Nothing due.",
    failedToStart: "Payment could not start. Try again or pay at the desk.",
    enterPassword: "Enter your password to continue.",
  },
  errors: {
    recordsUnreachable: "I cannot reach the gym's records right now",
    privateRecordsUnreachable: "I cannot read your records right now",
  },
  cardAge: {
    lastConfirmed: (date: string) => `This was last confirmed on ${date}.`,
  },
  meta: {
    appTitle: "Spotter",
    appDescription: "Official gym member portal",
  },
  nav: {
    getStarted: "Get Started",
  },
} as const;
