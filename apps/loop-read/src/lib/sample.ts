import { splitWords } from "./words";

export const SAMPLE_TITLE = "Pace drill";

export const SAMPLE_TEXT = [
  "Keep your eyes on this window.",
  "LOOP READ shows the next word, or a short group, at the pace you choose.",
  "One point five times is a brisk walk.",
  "Twice is a run.",
  "Three times is a sprint.",
  "Pause if you want the thought to catch up.",
  "This drill uses sample text only.",
  "Your books stay in the library after you upload a file you already own.",
  "When a book reaches the last word, you earn a badge.",
].join(" ");

export const SAMPLE_WORDS = splitWords(SAMPLE_TEXT);
