import type { Metadata } from "next";
import { Handy } from "@/components/benches/Handy";

export const metadata: Metadata = { title: "Handy" };

export default function Page() {
  return <Handy />;
}
