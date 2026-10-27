import type { Metadata } from "next";
import { Services } from "@/components/benches/Services";

export const metadata: Metadata = { title: "Artcraft services" };

export default function Page() {
  return <Services />;
}
