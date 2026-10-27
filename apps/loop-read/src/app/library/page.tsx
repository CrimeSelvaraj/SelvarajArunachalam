import { LibraryManager } from "@/components/LibraryManager";
import styles from "@/components/screens.module.css";
import { gatePaid } from "@/lib/gate";
import { listBooks } from "@/lib/library";

export const metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ unlocked?: string }>;
}) {
  const user = await gatePaid();
  const { unlocked } = await searchParams;
  const books = await listBooks(user);

  return (
    <section className={styles.wide}>
      <p className={styles.kicker}>Library</p>
      <h1>Files you already own</h1>
      <p className={styles.lede}>
        Add a plain-text file, a simple EPUB, or a PDF with selectable text. LOOP READ keeps the words so the speed reader can flash them.
      </p>
      {unlocked === "1" ? (
        <p className={styles.status} role="status">
          Access unlocked. Upload a file you own to start reading.
        </p>
      ) : null}
      <LibraryManager initialBooks={books} />
    </section>
  );
}
