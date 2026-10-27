import type { Metadata } from "next";
import { Pinocchio } from "@/components/benches/Pinocchio";

export const metadata: Metadata = { title: "Pinocchio" };

export default function Page() {
  return <Pinocchio />;
}
