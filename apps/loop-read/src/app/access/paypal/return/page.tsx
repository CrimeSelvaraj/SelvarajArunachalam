import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/components/screens.module.css";
import { completePaypalCheckout } from "@/lib/billing";
import { HttpError } from "@/lib/errors";

export const metadata = { title: "Confirming payment" };

export default async function PaypalReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/access?paypal=missing");

  try {
    await completePaypalCheckout(token);
  } catch (error) {
    const message = error instanceof HttpError ? error.message : "PayPal could not confirm the payment.";
    return (
      <section className={styles.narrow}>
        <h1>Payment not confirmed</h1>
        <p className={styles.alert} role="alert">
          {message}
        </p>
        <Link className={styles.secondary} href="/access">
          Back to access
        </Link>
      </section>
    );
  }

  redirect("/library?unlocked=1");
}
