import Link from "next/link";
import { FlashWord } from "@/components/FlashWord";
import { getViewer } from "@/lib/auth";
import reader from "@/components/reader.module.css";
import styles from "@/components/screens.module.css";

export default async function HomePage() {
  const viewer = await getViewer();
  const signedIn = viewer.kind === "user";
  const primary = !signedIn ? "/login" : viewer.user.paid ? "/library" : "/access";
  const primaryLabel = !signedIn ? "Sign in" : viewer.user.paid ? "Open library" : "Unlock access";

  return (
    <div className={styles.wide}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>LOOP READ</p>
          <h1>Read Faster...Think Smarter</h1>
          <p className={styles.lede}>
            A quiet speed reader for files you already own. Upload text, pick a pace, and let the words come to a single spot on the screen.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href={primary}>
              {primaryLabel}
            </Link>
            <Link className={styles.secondary} href="/read/sample">
              Try the sample drill
            </Link>
          </div>
        </div>
        <div className={reader.stage} aria-hidden="true">
          <p className={reader.chunk} data-count={1}>
            <FlashWord word="Smarter" emphasize />
          </p>
        </div>
      </section>
      <ol className={styles.steps}>
        <li>Sign in with your email. One active session at a time.</li>
        <li>Unlock access for 1 USD with PayPal, or the demo path when PayPal is not configured.</li>
        <li>Upload a .txt, EPUB, or PDF you already own. There is no book catalog.</li>
        <li>Read at 1.5×, 2×, or 3×. Finish a book and keep the badge.</li>
      </ol>
      <p className={styles.note}>
        Files you upload stay on this server as extracted text. LOOP READ does not search for books or download them for you.
      </p>
    </div>
  );
}
