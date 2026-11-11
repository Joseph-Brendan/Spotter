"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { copy } from "@/lib/copy";
import type { MemberBillingSummary } from "@/types/member";
import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
} from "@/types/payments";

export interface SessionMember {
  memberId: string;
  name: string;
  email: string;
  memberNumber: string;
  emailVerified: boolean;
  mustChangePassword: boolean;
}

interface SessionPayload {
  member: SessionMember | null;
  billing: MemberBillingSummary | null;
  billingError: boolean;
}

interface LoginInput {
  email: string;
  password: string;
}

interface SignUpInput {
  name: string;
  email: string;
  memberNumber: string;
  password: string;
  acceptedPrivacy: boolean;
}

interface ResetPasswordInput {
  email: string;
  tempPassword: string;
  newPassword: string;
}

interface LoginResponse {
  success: boolean;
  session: SessionMember;
}

interface SignUpResponse {
  success: boolean;
  session: SessionMember;
}

interface ResetPasswordResponse {
  success: boolean;
  session?: SessionMember;
}

interface LogoutResponse {
  success: boolean;
}

interface DeleteAccountResponse {
  success: boolean;
}

interface VerifyEmailResponse {
  success: boolean;
}

interface ResendVerificationResponse {
  success: boolean;
  alreadyVerified?: boolean;
}


const SESSION_KEY = ["auth", "session"] as const;

async function postJson<T>(
  url: string,
  body: unknown | undefined,
  fallbackError: string
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data.error === "string" && data.error.length > 0 ? data.error : fallbackError;
    throw new Error(message);
  }

  return data as T;
}

function useSessionCache() {
  const queryClient = useQueryClient();

  return {
    setMember: (member: SessionMember | null) => {
      queryClient.setQueryData<SessionPayload>(SESSION_KEY, {
        member,
        billing: null,
        billingError: false,
      });
    },
    markVerified: () => {
      queryClient.setQueryData<SessionPayload>(SESSION_KEY, (previous) =>
        previous?.member
          ? {
              ...previous,
              member: { ...previous.member, emailVerified: true },
            }
          : previous
      );
    },
    refresh: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
  };
}

export function useSession() {
  const query = useQuery<SessionPayload>({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const response = await fetch("/api/auth/session");

      if (!response.ok) {
        throw new Error(copy.login.failed);
      }

      const data = await response.json();
      return {
        member: data.member ?? null,
        billing: data.billing ?? null,
        billingError: data.billingError === true,
      };
    },
  });

  return {
    member: query.data?.member ?? null,
    billing: query.data?.billing ?? null,
    billingError: query.data?.billingError ?? false,
    isLoading: query.isPending,
  };
}

export function useRefreshSession() {
  const queryClient = useQueryClient();

  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
    [queryClient]
  );
}

export function useLogin() {
  const { setMember, refresh } = useSessionCache();

  return useMutation({
    mutationFn: (input: LoginInput) =>
      postJson<LoginResponse>("/api/auth/login", input, copy.login.failed),
    onSuccess: (data) => {
      setMember(data.session);
      void refresh();
    },
  });
}

export function useSignUp() {
  const { setMember, refresh } = useSessionCache();

  return useMutation({
    mutationFn: (input: SignUpInput) =>
      postJson<SignUpResponse>("/api/auth/signup", input, copy.signup.memberNumberNotFound),
    onSuccess: (data) => {
      setMember(data.session);
      void refresh();
    },
  });
}

export function useResetPassword() {
  const { setMember, refresh } = useSessionCache();

  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      postJson<ResetPasswordResponse>("/api/auth/reset-password", input, copy.login.failed),
    onSuccess: (data) => {
      if (data.session) {
        setMember(data.session);
        void refresh();
      }
    },
  });
}

export function useLogout() {
  const { setMember } = useSessionCache();

  return useMutation({
    mutationFn: () =>
      postJson<LogoutResponse>("/api/auth/session", undefined, copy.errors.signOutFailed),
    onSuccess: () => setMember(null),
  });
}

export function useDeleteAccount() {
  const { setMember } = useSessionCache();

  return useMutation({
    mutationFn: (password: string) =>
      postJson<DeleteAccountResponse>(
        "/api/auth/delete-account",
        { password },
        copy.deletion.passwordWrong
      ),
    onSuccess: () => setMember(null),
  });
}

export function useVerifyEmail() {
  const { markVerified } = useSessionCache();

  return useMutation({
    mutationFn: (code: string) =>
      postJson<VerifyEmailResponse>(
        "/api/auth/verify-email",
        { code },
        copy.verification.invalidCode
      ),
    onSuccess: () => markVerified(),
  });
}

export function useResendVerification() {
  const { markVerified } = useSessionCache();

  return useMutation({
    mutationFn: () =>
      postJson<ResendVerificationResponse>(
        "/api/auth/verify-email/resend",
        undefined,
        copy.verification.sendFailed
      ),
    onSuccess: (data) => {
      if (data.alreadyVerified) {
        markVerified();
      }
    },
  });
}

export function useInitiatePayment() {
  const { refresh } = useSessionCache();

  return useMutation({
    mutationFn: (input: InitiatePaymentInput) =>
      postJson<InitiatePaymentResult>(
        "/api/payments/initiate",
        input,
        copy.payments.failedToStart
      ),
    onSuccess: () => {
      void refresh();
    },
  });
}
