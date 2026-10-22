import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Owner Review | Spotter",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OwnerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
