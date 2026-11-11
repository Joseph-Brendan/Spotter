import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import "@/styles/tokens.css";

export const metadata: Metadata = {
  title: {
    default: copy.meta.appTitle,
    template: `%s | ${copy.meta.appTitle}`,
  },
  description: copy.meta.appDescription,
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          boxSizing: "border-box",
          fontFamily: "var(--font-family-base)",
          backgroundColor: "var(--color-background)",
          color: "var(--color-on-background)",
        }}
      >
        {children}
      </body>
    </html>
  );
}
