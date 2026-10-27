"use client";

import { useParams } from "next/navigation";
import { Notice } from "@/components/ui";
import { studioDemos } from "@/components/benches/studios";

export function StudioBench() {
  const params = useParams<{ studioId: string }>();
  const studioId = typeof params.studioId === "string" ? params.studioId : "";
  const Demo = studioDemos[studioId];
  if (!Demo) {
    return (
      <div className="page">
        <Notice tone="error" title="That studio is not on the bench">
          Pick a studio from the side panel.
        </Notice>
      </div>
    );
  }
  return <Demo />;
}
