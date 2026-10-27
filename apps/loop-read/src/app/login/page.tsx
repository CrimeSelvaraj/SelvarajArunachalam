import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import styles from "@/components/screens.module.css";
import { getViewer } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer.kind === "user") {
    redirect(viewer.user.paid ? "/library" : "/access");
  }
  const { reason } = await searchParams;
  return (
    <section className={styles.narrow}>
      <p className={styles.kicker}>Account</p>
      <h1>Sign in</h1>
      <p className={styles.lede}>Use the email that should own this library. No password.</p>
      <div className={styles.card}>
        <LoginForm replaced={reason === "replaced" || viewer.kind === "replaced"} />
      </div>
    </section>
  );
}
