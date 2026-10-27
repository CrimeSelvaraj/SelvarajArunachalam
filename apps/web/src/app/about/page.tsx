import Link from "next/link";
import styles from "../interior.module.css";

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden />
      <div className={styles.inner}>
        <p className={styles.kicker}>How it works</p>
        <h1 className={styles.title}>Transparent research, news structure</h1>
        <p className={styles.lede}>
          ProofPress turns a topic into a scholarly news brief grounded in open
          literature — starting with real OpenAlex discovery, then a staged
          pipeline you can watch.
        </p>
        <ol className={styles.list}>
          <li>
            <strong>Search</strong> — query OpenAlex for works (title, authors,
            year, DOI, abstract snippet, OA/PDF hints).
          </li>
          <li>
            <strong>Screen</strong> — rank and dedupe candidates (stub for now;
            ASReview-inspired later).
          </li>
          <li>
            <strong>Read</strong> — gather OA abstracts/PDFs into an evidence pack
            (PaperQA adapter next).
          </li>
          <li>
            <strong>Draft & cite</strong> — news lede + claim→source map, then
            bibliography and Pandoc export.
          </li>
        </ol>
        <p className={styles.body}>
          We prefer open corpus sources and never bypass paywalls. GitHub
          software discovery and full composition ship in later phases.
        </p>
        <Link href="/" className={styles.link}>
          ← Start a topic
        </Link>
      </div>
    </main>
  );
}
