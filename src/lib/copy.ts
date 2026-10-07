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
    getStartedForFree: "Get Started for Free",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
  },
  marketing: {
    heroSubtitleLead: "Check in, view your records and balance,",
    heroSubtitleTail: "and get verified gym answers.",
  },
} as const;

export interface LegalBlock {
  type: "p" | "ul";
  items: readonly string[];
}

export interface LegalSection {
  heading: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  title: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
}

export const legalCopy: {
  shared: { backToApp: string };
  privacy: LegalDocument;
  terms: LegalDocument;
} = {
  shared: {
    backToApp: "Back to Spotter",
  },
  privacy: {
    title: "Privacy Policy",
    lastUpdated: "Last updated: 6 October 2026",
    sections: [
      {
        heading: "Who controls your data",
        blocks: [
          {
            type: "p",
            items: [
              "The gym that registered your membership is the data controller. The controller decides what is held and why.",
              "The developer of Spotter is a data processor. The developer runs the app for the gym and follows the gym's instructions.",
              "This follows the Nigeria Data Protection Act 2023.",
            ],
          },
        ],
      },
      {
        heading: "What the app stores",
        blocks: [
          {
            type: "ul",
            items: [
              "Your account details: full name, email address, member number and password. The password is stored as a hash, never as plain text.",
              "Your member record: phone number, tier, expiry date and opening balance, as the gym recorded them.",
              "Your attendance: the date and time of each claimed arrival and each check in code you generate.",
              "Your money records: charges, payments, receipts and ledger entries, including payments you make in the app.",
              "Your questions: the text of each question and the outcome, with your member number attached.",
              "Access logs: every read of your private records, with the member ID, the function and the time.",
            ],
          },
        ],
      },
      {
        heading: "How your records are protected",
        blocks: [
          {
            type: "p",
            items: [
              "Private records are read by the exact member ID in your session, never from anything you type.",
              "Private records are never searched across members and never embedded.",
              "Every private read is logged, and a scheduled check flags any read where the session member ID does not match the record.",
              "The AI model never receives your private records. Answers about your records come from fixed code, not from the model.",
            ],
          },
        ],
      },
      {
        heading: "Who sees your data",
        blocks: [
          {
            type: "p",
            items: [
              "You see your own attendance, tier, expiry, payments, receipts and balance.",
              "The owner sees your name, email address, phone number, member number, tier, expiry, payments and ledger entries. The owner also sees your question text with your member number attached, because he cannot correct a wrong record without knowing whose it is.",
              "Front desk staff see your attendance, effective tier and expiry. They do not see your balance or payment history.",
              "The developer can access the service to run, secure and support it, under the gym's instructions.",
              "The door keypad checks a code's digits only and returns nothing else.",
            ],
          },
        ],
      },
      {
        heading: "Why the app holds it",
        blocks: [
          {
            type: "ul",
            items: [
              "To sign you in and keep your session secure.",
              "To record claimed arrivals and show your attendance.",
              "To show your balance and take renewal and arrears payments.",
              "To answer your questions from the gym's approved records.",
              "To detect a read that does not match a session.",
              "To let the owner audit answers and correct wrong records.",
            ],
          },
        ],
      },
      {
        heading: "Check in codes and claimed arrivals",
        blocks: [
          {
            type: "p",
            items: [
              "You generate each check in code in the app. A code is single use and expires.",
              "A check in records your claim that you arrived. It is not proof that you were in the building. The app does not open the door.",
            ],
          },
        ],
      },
      {
        heading: "How long the gym keeps it",
        blocks: [
          {
            type: "ul",
            items: [
              "Attendance records, question logs, access logs and check in codes: twenty four months.",
              "Payment records and receipts: seven years, because they are financial records.",
              "Member identity records, including your email address and password hash: while your membership is active, and twenty four months after cancellation.",
            ],
          },
        ],
      },
      {
        heading: "Your rights under Nigerian law",
        blocks: [
          {
            type: "p",
            items: [
              "The Nigeria Data Protection Act 2023 gives you rights over your personal data.",
            ],
          },
          {
            type: "ul",
            items: [
              "To know what is held about you and to get a copy.",
              "To correct a record that is wrong.",
              "To ask for deletion where the law allows it.",
              "To restrict or object to certain processing.",
              "To withdraw consent where consent is the basis for holding your data.",
              "To complain to the Nigeria Data Protection Commission.",
            ],
          },
          {
            type: "p",
            items: [
              "To ask for a copy or a deletion, speak to the front desk officer or the owner. Some financial records must be kept for seven years by law.",
            ],
          },
        ],
      },
      {
        heading: "No contact from the app",
        blocks: [
          {
            type: "p",
            items: [
              "The app never messages you first. It sends no email, no reminders and no marketing.",
              "The gym does not bill you automatically. Charges are posted by hand.",
            ],
          },
        ],
      },
      {
        heading: "Changes to this policy",
        blocks: [
          {
            type: "p",
            items: [
              "The gym can update this policy. The date at the top changes when it does.",
            ],
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          {
            type: "p",
            items: [
              "For anything about this policy, speak to the front desk officer at your gym.",
            ],
          },
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    lastUpdated: "Last updated: 6 October 2026",
    sections: [
      {
        heading: "About these terms",
        blocks: [
          {
            type: "p",
            items: [
              "Spotter is the member app of your gym. By creating an account you agree to these terms.",
              "Your gym membership is a contract with the gym. These terms cover your use of the app.",
            ],
          },
        ],
      },
      {
        heading: "Who can use Spotter",
        blocks: [
          {
            type: "p",
            items: [
              "Only a member the gym has registered. You sign up with the member number on your gym card. One member record, one account.",
              "The gym creates your member record before you can sign up.",
            ],
          },
        ],
      },
      {
        heading: "Your account",
        blocks: [
          {
            type: "p",
            items: [
              "You give your full name, email address, password and member number when you sign up.",
              "Keep your password private and do not share your account. You are responsible for what happens under your account.",
              "If you forget your password, ask the front desk. The owner issues a temporary password. It works once, expires in twenty four hours, and you must set a new password before you continue.",
              "The owner can revoke your sessions, which signs you out on every device.",
            ],
          },
        ],
      },
      {
        heading: "What the app does",
        blocks: [
          {
            type: "ul",
            items: [
              "Ask about the gym. Answers come only from the gym's approved records, with the source card and the date it was last confirmed. The answer model never reads your private records.",
              "My records. Your attendance, and your balance. Money figures are reported from the ledger, never ruled on.",
              "Check in. You generate a six digit single use code and enter it at the door keypad. One check in per member per calendar day.",
              "Pay. Renewal or arrears through Flutterwave, settling into the gym's account. A confirmed payment extends your membership immediately.",
              "Ask the desk. The app names the officer on duty and opens WhatsApp with your question typed.",
            ],
          },
        ],
      },
      {
        heading: "Questions the app refuses",
        blocks: [
          {
            type: "p",
            items: [
              "The app refuses some questions even when a record exists. It will not answer anything about another member, anything medical including injury, pain, diet and supplements, whether the door will open right now, refunds, waivers, discounts and cancellation decisions, or staff conduct.",
              "When the records hold no answer, the app says so and hands you to the front desk officer by name.",
            ],
          },
        ],
      },
      {
        heading: "Check in rules",
        blocks: [
          {
            type: "p",
            items: [
              "A code is single use and expires. The app confirms a check in when the code is consumed.",
              "A check in records a claimed arrival. It does not prove you were in the building and it does not open the door.",
              "One check in per member per calendar day. If your phone is dead, staff can record a manual check in for you.",
              "An expired or cancelled member cannot generate a check in code until the membership is renewed.",
            ],
          },
        ],
      },
      {
        heading: "Payments",
        blocks: [
          {
            type: "p",
            items: [
              "You can pay a renewal or arrears in the app. Flutterwave processes the payment into the gym's account.",
              "Only a confirmed payment extends your membership. A pending or abandoned attempt changes nothing.",
              "The app does not bill you automatically. The gym posts charges by hand.",
              "A payment record cannot be edited or deleted. A mistake is corrected with a visible offsetting entry.",
              "Refunds, waivers, discounts and cancellation decisions belong to the gym. Ask the front desk.",
              "Your receipts show in your records after a confirmed payment.",
            ],
          },
        ],
      },
      {
        heading: "Tier, expiry and grace",
        blocks: [
          {
            type: "p",
            items: [
              "Your tier, Basic or Premium, decides which shared records you can see.",
              "When membership expires, the gym applies its grace days. After grace, access changes until you renew.",
              "An expired or cancelled member keeps attendance history, receipts, the timetable, the price list and the pay button.",
            ],
          },
        ],
      },
      {
        heading: "Acceptable use",
        blocks: [
          {
            type: "p",
            items: [
              "Use the app for yourself only.",
              "Do not try to read another member's records, interfere with the service, or copy the gym's records for other uses.",
              "Do not share your password or your account.",
            ],
          },
        ],
      },
      {
        heading: "Availability and accuracy",
        blocks: [
          {
            type: "p",
            items: [
              "The gym's records are the source of every answer. The app reports what the records show, including the date a card was last confirmed.",
              "The service depends on networks and devices and can be unavailable.",
              "The app gives no medical, training, diet or injury advice. It does not book classes and it does not control the door.",
              "Speak to the front desk about anything outside the app.",
            ],
          },
        ],
      },
      {
        heading: "Limits",
        blocks: [
          {
            type: "p",
            items: [
              "To the extent Nigerian law allows, the developer is not liable for indirect or consequential loss from your use of the app.",
              "Nothing in these terms limits rights you have under Nigerian law.",
            ],
          },
        ],
      },
      {
        heading: "Privacy",
        blocks: [
          {
            type: "p",
            items: [
              "The Privacy Policy explains how your personal data is held. The gym is the data controller. The developer is a data processor.",
            ],
          },
        ],
      },
      {
        heading: "Changes and ending",
        blocks: [
          {
            type: "p",
            items: [
              "The gym can update these terms. The date at the top changes when it does.",
              "The gym can suspend or end your app access as your membership requires. If you do not accept an update, stop using the app and speak to the front desk.",
            ],
          },
        ],
      },
      {
        heading: "Governing law",
        blocks: [
          {
            type: "p",
            items: [
              "These terms are governed by the laws of the Federal Republic of Nigeria. Disputes go to the courts of Nigeria.",
            ],
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          {
            type: "p",
            items: [
              "The front desk officer at your gym.",
            ],
          },
        ],
      },
    ],
  },
};
