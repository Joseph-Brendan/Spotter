import type { Metadata } from "next";
import AuthView, { type AuthViewKind } from "@/components/auth-view";

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
  searchParams: Promise<{ view?: string | string[] }>;
}

export async function generateMetadata({ searchParams }: AuthPageProps): Promise<Metadata> {
  const { view } = await searchParams;
  return { title: VIEW_TITLES[parseView(view)] };
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const { view } = await searchParams;
  return <AuthView view={parseView(view)} />;
}
