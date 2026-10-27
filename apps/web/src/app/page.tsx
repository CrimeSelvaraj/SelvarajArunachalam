import type { Metadata } from "next";
import { HomeBench } from "@/components/benches/HomeBench";

export const metadata: Metadata = {
  title: { absolute: "ATOZ" },
  description: "The whole alphabet of making, on one bench.",
};

export default function Page() {
  return <HomeBench />;
}
