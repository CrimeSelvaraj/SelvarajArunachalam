import Link from "next/link";
import { LoopMark } from "@/components/LoopMark";
import styles from "@/components/screens.module.css";
import { gatePaid } from "@/lib/gate";
import { listBadges } from "@/lib/library";

export const metadata = { title: "Badges" };

export default async function BadgesPage() {
  const user = await gatePaid();
  const badges = await listBadges(user);

  return (
    <section className={styles.narrow}>
      <p className={styles.kicker}>Badges</p>
      <h1>Finished books</h1>
      <p className={styles.lede}>Each book you read to the last word earns one Loop closed badge.</p>
      {badges.length === 0 ? (
        <div className={styles.card}>
          <p className={styles.note}>Nothing here yet. Finish a book in the reader and the badge will land on this page.</p>
          <Link className={styles.primary} href="/library">
            Go to the library
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {badges.map((badge) => (
            <li key={badge.id} className={styles.badge}>
              <div className={styles.mark}>
                <LoopMark size={32} />
              </div>
              <div>
                <p className={styles.kicker}>{badge.name}</p>
                <h2>{badge.bookTitle}</h2>
                <p className={styles.hint}>
                  {new Date(badge.earnedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <Link href={`/read/${badge.bookId}`}>Open book</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
