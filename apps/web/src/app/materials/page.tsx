import type { Metadata } from "next";
import { Materials } from "@/components/benches/Materials";

export const metadata: Metadata = { title: "ARENA materials" };

export default function Page() {
  return <Materials />;
}
