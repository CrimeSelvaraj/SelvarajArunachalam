/** Comfortable page-reading baseline. The pace buttons multiply this. */
export const BASE_WPM = 200;

export const SPEEDS = [
  { id: "1.5", label: "1.5×", wpm: 300 },
  { id: "2", label: "2×", wpm: 400 },
  { id: "3", label: "3×", wpm: 600 },
] as const;

export type SpeedId = (typeof SPEEDS)[number]["id"];
export type ChunkMode = "one" | "two" | "group";

export function wpmFor(id: string): number {
  const match = SPEEDS.find((speed) => speed.id === id);
  return match ? match.wpm : SPEEDS[0].wpm;
}

export function chunkSize(mode: ChunkMode): number {
  if (mode === "two") return 2;
  if (mode === "group") return 3;
  return 1;
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** RSVP pivot, slightly left of center, so the eye can stay parked. */
export function pivotIndex(word: string): number {
  const len = [...word].length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}
