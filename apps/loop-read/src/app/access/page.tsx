import Link from "next/link";
import { AccessActions } from "@/components/AccessActions";
import styles from "@/components/screens.module.css";
import { gateUser } from "@/lib/gate";
import { paypalEnabled } from "@/lib/billing";

export const metadata = { title: "Access" };

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ paypal?: string }>;
}) {
  const user = await gateUser();
  const { paypal } = await searchParams;
  const configured = paypalEnabled();

  return (
    <section className={styles.narrow}>
      <p className={styles.kicker}>Access</p>
      <h1>One dollar, then the library is yours</h1>
      <p className={styles.price}>
        $1 <span>USD · one time</span>
      </p>
      {paypal === "cancel" ? (
        <p className={styles.status} role="status">
          PayPal checkout was canceled. You have not been charged.
        </p>
      ) : null}
      {paypal === "missing" ? (
        <p className={styles.alert} role="alert">
          PayPal did not return an order to confirm.
        </p>
      ) : null}
      {user.paid ? (
        <div className={styles.card}>
          <p className={styles.status} role="status">
            {user.paymentMethod === "demo"
              ? "Access is unlocked with demo checkout. No charge was made."
              : "Access is unlocked with PayPal."}
          </p>
          <Link className={styles.primary} href="/library">
            Go to the library
          </Link>
        </div>
      ) : (
        <div className={styles.card}>
          <AccessActions mode={configured ? "paypal" : "demo"} />
        </div>
      )}
    </section>
  );
}
