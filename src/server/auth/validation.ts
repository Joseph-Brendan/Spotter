import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMBER_NUMBER_PATTERN = /^\d{6}$/;
const PASSWORD_MIN_LENGTH = 8;

export const signUpSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().regex(EMAIL_PATTERN),
  memberNumber: z.string().trim().regex(MEMBER_NUMBER_PATTERN),
  password: z.string().trim().min(PASSWORD_MIN_LENGTH),
  acceptedPrivacy: z.literal(true),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().trim().min(1),
});

export const staffLoginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export const reserveMemberNumberSchema = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL_PATTERN),
});

export const memberNumberSchema = z.string().trim().regex(MEMBER_NUMBER_PATTERN);

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase(),
  tempPassword: z.string().trim().min(1),
  newPassword: z.string().trim().min(PASSWORD_MIN_LENGTH),
});

export const verifyEmailSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
});

export const deleteAccountSchema = z.object({
  password: z.string().trim().min(1),
});

export type SignUpPayload = z.infer<typeof signUpSchema>;
export type LoginPayload = z.infer<typeof loginSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailPayload = z.infer<typeof verifyEmailSchema>;
export type DeleteAccountPayload = z.infer<typeof deleteAccountSchema>;

function firstIssuePath(error: z.ZodError): string | undefined {
  const path = error.issues[0]?.path[0];
  return typeof path === "string" ? path : undefined;
}

export function signUpErrorMessage(error: z.ZodError): string {
  switch (firstIssuePath(error)) {
    case "name":
      return copy.validation.nameMinLength;
    case "email":
      return copy.validation.emailInvalid;
    case "memberNumber":
      return copy.validation.memberNumberInvalid;
    case "password":
      return copy.signup.passwordMinLength;
    case "acceptedPrivacy":
      return copy.validation.acceptTermsRequired;
    default:
      return copy.validation.fieldRequired;
  }
}

export function loginErrorMessage(): string {
  return copy.login.failed;
}

export function resetPasswordErrorMessage(error: z.ZodError): string {
  return firstIssuePath(error) === "newPassword"
    ? copy.signup.passwordMinLength
    : copy.login.failed;
}
