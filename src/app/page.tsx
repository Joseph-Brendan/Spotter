import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import HomeView from "@/components/home-view";

export const metadata: Metadata = {
  title: "Spotter | Official Gym Member Portal",
  description: copy.meta.appDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: copy.meta.appTitle,
    title: "Spotter | Official Gym Member Portal",
    description: copy.meta.appDescription,
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Spotter | Official Gym Member Portal",
    description: copy.meta.appDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function HomePage() {
  return <HomeView />;
}
