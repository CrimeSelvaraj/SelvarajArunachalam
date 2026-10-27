import { SpeedReader } from "@/components/SpeedReader";
import { gatePaid } from "@/lib/gate";
import { SAMPLE_TITLE, SAMPLE_WORDS } from "@/lib/sample";

export const metadata = { title: "Sample drill" };

export default async function SamplePage() {
  await gatePaid();
  return <SpeedReader kicker="Sample" title={SAMPLE_TITLE} words={SAMPLE_WORDS} />;
}
