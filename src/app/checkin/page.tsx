import type { Metadata } from "next";
import { notFound } from "next/navigation";
import KeypadSimulator from "@/components/checkin/keypad-simulator";
import { copy } from "@/lib/copy";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: copy.keypad.title,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function CheckInKeypadPage() {
  if (!env.CHECKIN_SIMULATED) {
    notFound();
  }

  return <KeypadSimulator />;
}
