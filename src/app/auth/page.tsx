import type { Metadata } from "next";
import AuthView, { type AuthViewKind } from "@/components/auth-view";
import QueryProvider from "@/components/query-provider";

const VIEW_TITLES: Record<AuthViewKind, string> = {
  login: "Log In",
  signup: "Sign Up",
  reset: "Reset Password",
};

function parseView(value: string | string[] | undefined): AuthViewKind {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "signup" || raw === "reset" ? raw : "login";
}

interface AuthPageProps {
  searchParams: Promise<{ view?: string | string[]; email?: string | string[] }>;
}

export async function generateMetadata({ searchParams }: AuthPageProps): Promise<Metadata> {
  const { view } = await searchParams;
  return { title: VIEW_TITLES[parseView(view)] };
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const { view, email } = await searchParams;
  const initialEmail = Array.isArray(email) ? email[0] : email;
  return (
    <QueryProvider>
      <AuthView view={parseView(view)} initialEmail={initialEmail} />
    </QueryProvider>
  );
}
