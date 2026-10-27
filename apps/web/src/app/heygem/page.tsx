import type { Metadata } from "next";
import { HeyGem } from "@/components/benches/HeyGem";

export const metadata: Metadata = { title: "HeyGem" };

export default function Page() {
  return <HeyGem />;
}
