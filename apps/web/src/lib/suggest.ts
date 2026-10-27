import { featureById } from "@/features";

const rules: Array<[RegExp, string]> = [
  [/\b(avatar|portrait|talking|heygem)\b/, "heygem"],
  [/\b(voice|speak|narration|clone|omnivoice)\b/, "omnivoice"],
  [/\b(transcript|dictate|subtitle|handy)\b/, "handy"],
  [/\b(node|workflow|comfy|graph)\b/, "workflow"],
  [/\b(robot|joint|rig|pose|pinocchio)\b/, "pinocchio"],
  [/\b(pdf|document)\b/, "revpdf"],
  [/\b(vote|compare|arena)\b/, "arena"],
  [/\b(learn|lesson|study)\b/, "materials"],
  [/\b(job|queue)\b/, "services"],
  [/\b(photo|exposure)\b/, "photocraft"],
  [/\b(light|shadow|lamp)\b/, "lightcraft"],
  [/\b(film|scene|video)\b/, "filmcraft"],
  [/\b(write|story|essay|poem|caption)\b/, "wordcraft"],
  [/\b(vector|svg|logo|icon)\b/, "vectorcraft"],
  [/\b(effect|glitch|grain)\b/, "effectcraft"],
  [/\b(cad|dimension|isometric|mm)\b/, "cadcraft"],
  [/\b(grid|layout|columns)\b/, "gridcraft"],
  [/\b(slide|deck|presentation)\b/, "deckcraft"],
];

export function suggestBench(prompt: string): { featureId: string; steps: string[] } {
  const text = prompt.toLowerCase();
  const featureId = rules.find(([rule]) => rule.test(text))?.[1] ?? "artcraft";
  const name = featureById(featureId)?.name ?? "Artcraft";
  return {
    featureId,
    steps: [
      "Keep the concrete nouns in the work order.",
      `Open ${name} and run the main action once.`,
      "Keep the result you would actually show someone.",
    ],
  };
}
