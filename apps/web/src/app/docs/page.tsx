import Link from "next/link";
import styles from "../interior.module.css";

export default function DocsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden />
      <div className={styles.inner}>
        <p className={styles.kicker}>Docs & export</p>
        <h1 className={styles.title}>Formats coming after discovery</h1>
        <p className={styles.lede}>
          Export and citation polish land with Pandoc and CSL-JSON in later
          phases. For now, jobs expose OpenAlex candidates in the UI and via{" "}
          <code>GET /jobs/&#123;id&#125;</code>.
        </p>
        <ul className={styles.list}>
          <li>Markdown / HTML / DOCX via Pandoc (Phase 9)</li>
          <li>BibTeX download with stable citekeys (Phase 8)</li>
          <li>Inline citations matching the bibliography</li>
        </ul>
        <p className={styles.body}>
          Maintainers: OpenAlex is called as a thin HTTP client against{" "}
          <code>https://api.openalex.org</code> — we do not vendor openalex-help.
          Set <code>OPENALEX_MAILTO</code> (and optionally{" "}
          <code>OPENALEX_API_KEY</code>) in <code>.env</code>.
        </p>
        <Link href="/" className={styles.link}>
          ← Back to ProofPress
        </Link>
      </div>
    </main>
  );
}
