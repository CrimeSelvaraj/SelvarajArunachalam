import type { Metadata } from "next";
import { StudioBench } from "@/components/benches/StudioBench";
import { featureById, STUDIO_IDS } from "@/features";

export const dynamicParams = false;

export function generateStaticParams() {
  return STUDIO_IDS.map((studioId) => ({ studioId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ studioId: string }>;
}): Promise<Metadata> {
  const { studioId } = await params;
  return { title: featureById(studioId)?.name ?? "Studio" };
}

export default function Page() {
  return <StudioBench />;
}
