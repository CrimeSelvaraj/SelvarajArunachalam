import { TopicComposer } from "@/components/TopicComposer";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.shell}>
      <div className={styles.atmosphere} aria-hidden>
        <div className={styles.wash} />
        <div className={styles.beam} />
        <div className={styles.grain} />
      </div>

      <section className={styles.hero}>
        <p className={styles.brand}>ProofPress</p>
        <h1 className={styles.headline}>
          Scholarly news,
          <span className={styles.headlineBreak}> grounded in open research.</span>
        </h1>
        <p className={styles.lede}>
          Enter a topic. We discover candidates, screen for relevance, then
          build an evidence pack (OA text + PaperQA when keyed) before drafting
          — not an uncited essay.
        </p>
        <TopicComposer />
      </section>
    </main>
  );
}
