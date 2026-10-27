import { pivotIndex } from "@/lib/words";
import styles from "./reader.module.css";

export function FlashWord({ word, emphasize = false }: { word: string; emphasize?: boolean }) {
  const chars = [...word];
  if (!emphasize || chars.length === 0) {
    return <span className={styles.word}>{word}</span>;
  }
  const index = Math.min(pivotIndex(word), chars.length - 1);
  return (
    <span className={styles.word}>
      {chars.slice(0, index).join("")}
      <span className={styles.pivot}>{chars[index]}</span>
      {chars.slice(index + 1).join("")}
    </span>
  );
}
