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
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          ProofPress
        </Link>
      </header>
      <article className={styles.article}>
        <p className={styles.kicker}>Article placeholder</p>
        <h1 className={styles.title}>Draft arrives in later phases</h1>
        <p className={styles.body}>
          Job <code className={styles.code}>{id}</code> finished the stub
          pipeline (search → screen → read → draft → cite). Real OpenAlex
          discovery, evidence packing, and composed narrative land in Phases
          3–7.
        </p>
        <Link href="/" className={styles.back}>
          ← Start another topic
        </Link>
      </article>
    </main>
  );
}
