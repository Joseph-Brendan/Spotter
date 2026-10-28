export type PaymentPurpose = "RENEWAL" | "ARREARS";

export interface InitiatePaymentInput {
  purpose: PaymentPurpose;
  tier: "BASIC" | "PREMIUM" | "DIAMOND";
  idempotencyKey: string;
  password?: string;
}

export interface InitiatePaymentResult {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}
