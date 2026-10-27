import type { Metadata } from "next";
import { Workflow } from "@/components/benches/Workflow";

export const metadata: Metadata = { title: "ComfyUI" };

export default function Page() {
  return <Workflow />;
}
