import Link from "next/link";
import styles from "../interior.module.css";

export default function SettingsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden />
      <div className={styles.inner}>
        <p className={styles.kicker}>Settings</p>
        <h1 className={styles.title}>Preferences placeholder</h1>
        <p className={styles.lede}>
          Depth (quick vs deep), citation style, and GitHub inclusion already
          exist on the job API — a settings form will wire them here without
          cluttering the landing hero.
        </p>
        <ul className={styles.list}>
          <li>
            Depth — quick (8 works, screen cap 12) / deep (12 works, screen
            cap 18)
          </li>
          <li>Citation style — APA / Nature / news (composer later)</li>
          <li>
            Include GitHub — toggle under Research options on the landing composer
            (default on; capped repo search with README + CITATION.cff)
          </li>
          <li>
            Screen max — optional override (4–40) for deep-read inclusion cap;
            heuristic ranker, optional LLM when a key is set
          </li>
        </ul>
        <Link href="/" className={styles.link}>
          ← Back to generate
        </Link>
      </div>
    </main>
  );
}
