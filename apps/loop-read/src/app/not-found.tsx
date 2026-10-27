import Link from "next/link";
import styles from "@/components/screens.module.css";

export default function NotFound() {
  return (
    <section className={styles.narrow}>
      <h1>That page is not here</h1>
      <p className={styles.lede}>The book may have been removed, or the address is off.</p>
      <Link className={styles.primary} href="/library">
        Back to the library
      </Link>
    </section>
  );
}
