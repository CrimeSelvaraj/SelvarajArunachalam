export type GroupId = "start" | "people" | "build" | "arena" | "studios" | "services";

export type Feature = {
  id: string;
  path: string;
  name: string;
  group: GroupId;
  summary: string;
};

export const groups: { id: GroupId; label: string }[] = [
  { id: "start", label: "Start" },
  { id: "people", label: "Voices & people" },
  { id: "build", label: "Build" },
  { id: "arena", label: "Arena" },
  { id: "studios", label: "Studios" },
  { id: "services", label: "Services" },
];

export const STUDIO_IDS = [
  "artcraft",
  "photocraft",
  "lightcraft",
  "filmcraft",
  "wordcraft",
  "vectorcraft",
  "effectcraft",
  "cadcraft",
  "gridcraft",
  "deckcraft",
] as const;

export const features: Feature[] = [
  {
    id: "start",
    path: "/",
    name: "Home",
    group: "start",
    summary: "Describe a piece of work and ATOZ drafts a short plan.",
  },
  {
    id: "heygem",
    path: "/heygem",
    name: "HeyGem",
    group: "people",
    summary: "Direct a talking portrait, then play the line on this device.",
  },
  {
    id: "omnivoice",
    path: "/omnivoice",
    name: "OmniVoice",
    group: "people",
    summary: "Save a voice profile from a short sample and speak a new line.",
  },
  {
    id: "handy",
    path: "/handy",
    name: "Handy",
    group: "people",
    summary: "Turn a sample take, or your microphone, into a transcript with times.",
  },
  {
    id: "workflow",
    path: "/workflow",
    name: "ComfyUI",
    group: "build",
    summary:
      "Wire a prompt, a model, a sampler, and a preview, then run the graph. This bench does not run the ComfyUI engine.",
  },
  {
    id: "pinocchio",
    path: "/pinocchio",
    name: "Pinocchio",
    group: "build",
    summary: "Set joint angles on a rigid figure and play a simple pose. This is a preview, not a physics solver.",
  },
  {
    id: "revpdf",
    path: "/revpdf",
    name: "RevPDF",
    group: "build",
    summary: "Open a text file or a simple PDF, then page through it and search.",
  },
  {
    id: "arena",
    path: "/arena",
    name: "Arena",
    group: "arena",
    summary: "Put two takes of one brief side by side and keep a favorite.",
  },
  {
    id: "materials",
    path: "/materials",
    name: "ARENA materials",
    group: "arena",
    summary: "Short tracks for the benches, with progress you can mark yourself.",
  },
  {
    id: "artcraft",
    path: "/studio/artcraft",
    name: "Artcraft",
    group: "studios",
    summary: "Compose an image from a short brief and a palette.",
  },
  {
    id: "photocraft",
    path: "/studio/photocraft",
    name: "Photocraft",
    group: "studios",
    summary: "Grade a studio still with exposure, contrast, and warmth.",
  },
  {
    id: "lightcraft",
    path: "/studio/lightcraft",
    name: "Lightcraft",
    group: "studios",
    summary: "Place a key light and watch the shadow move.",
  },
  {
    id: "filmcraft",
    path: "/studio/filmcraft",
    name: "Filmcraft",
    group: "studios",
    summary: "Build a shot list and play the timing back.",
  },
  {
    id: "wordcraft",
    path: "/studio/wordcraft",
    name: "Wordcraft",
    group: "studios",
    summary: "Draft a short page from a subject, a mood, and a few words.",
  },
  {
    id: "vectorcraft",
    path: "/studio/vectorcraft",
    name: "Vectorcraft",
    group: "studios",
    summary: "Place shapes and read the SVG they make.",
  },
  {
    id: "effectcraft",
    path: "/studio/effectcraft",
    name: "Effectcraft",
    group: "studios",
    summary: "Stack a few looks on a frame and render them.",
  },
  {
    id: "cadcraft",
    path: "/studio/cadcraft",
    name: "Cadcraft",
    group: "studios",
    summary: "Size a block and stamp an isometric ticket.",
  },
  {
    id: "gridcraft",
    path: "/studio/gridcraft",
    name: "Gridcraft",
    group: "studios",
    summary: "Set columns and rows, then lay the grid out.",
  },
  {
    id: "deckcraft",
    path: "/studio/deckcraft",
    name: "Deckcraft",
    group: "studios",
    summary: "Add slides and step through the deck.",
  },
  {
    id: "services",
    path: "/services",
    name: "Artcraft services",
    group: "services",
    summary: "Track studio jobs from queued to done.",
  },
];

export function featureById(id: string): Feature | undefined {
  return features.find((feature) => feature.id === id);
}

export function mustFeature(id: string): Feature {
  const feature = featureById(id);
  if (!feature) throw new Error(`Missing bench ${id}`);
  return feature;
}

export function groupLabel(id: GroupId): string {
  return groups.find((group) => group.id === id)?.label ?? id;
}

export function featuresIn(group: GroupId): Feature[] {
  return features.filter((feature) => feature.group === group);
}
