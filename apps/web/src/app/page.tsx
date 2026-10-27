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

      <header className={styles.brandBar}>
        <p className={styles.brand}>ProofPress</p>
      </header>

      <section className={styles.hero}>
        <h1 className={styles.headline}>
          Scholarly news,
          <span className={styles.headlineBreak}> grounded in open research.</span>
        </h1>
        <p className={styles.lede}>
          Enter a topic. Watch the search → screen → read → draft → cite pipeline
          unfold, then read a citation-aware brief — not an uncited essay.
        </p>
        <TopicComposer />
      </section>
    </main>
  );
}
