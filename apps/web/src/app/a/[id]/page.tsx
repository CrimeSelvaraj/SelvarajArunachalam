import Link from "next/link";
import styles from "./page.module.css";

type ArticlePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ArticlePlaceholderPage({ params }: ArticlePageProps) {
  const { id } = await params;

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden />
      <article className={styles.article}>
        <p className={styles.kicker}>Article placeholder</p>
        <h1 className={styles.title}>Draft arrives in later phases</h1>
        <p className={styles.body}>
          Job <code className={styles.code}>{id}</code> completed OpenAlex
          discovery (search is real). Screening, evidence packing, and the
          composed narrative land in Phases 5–7. Check the home flow for the
          saved works list on the job.
        </p>
        <div className={styles.actions}>
          <Link href="/" className={styles.back}>
            ← Start another topic
          </Link>
          <Link href="/jobs" className={styles.back}>
            Recent jobs
          </Link>
        </div>
      </article>
    </main>
  );
}
