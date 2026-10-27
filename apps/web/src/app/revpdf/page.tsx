import type { Metadata } from "next";
import { RevPdf } from "@/components/benches/RevPdf";

export const metadata: Metadata = { title: "RevPDF" };

export default function Page() {
  return <RevPdf />;
}
