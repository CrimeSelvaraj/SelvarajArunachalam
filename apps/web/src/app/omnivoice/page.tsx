import type { Metadata } from "next";
import { OmniVoice } from "@/components/benches/OmniVoice";

export const metadata: Metadata = { title: "OmniVoice" };

export default function Page() {
  return <OmniVoice />;
}
