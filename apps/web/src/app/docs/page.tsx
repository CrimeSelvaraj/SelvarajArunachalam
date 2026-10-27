import Link from "next/link";
import styles from "../interior.module.css";

export default function DocsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden />
      <div className={styles.inner}>
        <p className={styles.kicker}>Docs & export</p>
        <h1 className={styles.title}>Citations and Pandoc export</h1>
        <p className={styles.lede}>
          Completed jobs store a canonical CSL-JSON bibliography with
          BBT-inspired citekeys and APA reference lines that match inline{" "}
          <code>[n]</code> markers. Download Markdown, HTML, or DOCX via Pandoc
          from the article page, or call{" "}
          <code>GET /jobs/&#123;id&#125;/export.md|.html|.docx</code>. BibTeX
          remains at <code>GET /jobs/&#123;id&#125;/bibliography.bib</code>.
        </p>
        <ul className={styles.list}>
          <li>APA bibliography + stable citekeys (Phase 8)</li>
          <li>BibTeX and CSL-JSON download (Phase 8)</li>
          <li>Markdown / HTML / DOCX via Pandoc (Phase 9 — live)</li>
          <li>PDF deferred until TeX or typst is available</li>
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
