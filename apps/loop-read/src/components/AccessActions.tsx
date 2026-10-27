"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./screens.module.css";

export function AccessActions({ mode }: { mode: "paypal" | "demo" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function unlock() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/billing/demo-unlock", { method: "POST" });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Demo unlock failed.");
      return;
    }
    router.refresh();
    router.push("/library?unlocked=1");
  }

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/billing/paypal/create", { method: "POST" });
    const data = (await res.json()) as { approveUrl?: string; error?: string };
    if (!res.ok || !data.approveUrl) {
      setBusy(false);
      setError(data.error || "PayPal checkout could not start.");
      return;
    }
    window.location.assign(data.approveUrl);
  }

  return (
    <div className={styles.form}>
      {error ? (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      ) : null}
      {mode === "paypal" ? (
        <>
          <p className={styles.note}>You will leave this site to approve 1.00 USD in PayPal, then return here.</p>
          <button type="button" className={styles.primary} onClick={() => void pay()} disabled={busy}>
            {busy ? "Opening PayPal…" : "Pay 1 USD with PayPal"}
          </button>
        </>
      ) : (
        <>
          <div className={styles.banner} role="status">
            <strong>Demo checkout.</strong>
            <p>
              PayPal keys are not set on this server, so there is no live charge. This button unlocks the library for
              testing. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to use a real sandbox or live checkout.
            </p>
          </div>
          <button type="button" className={styles.primary} onClick={() => void unlock()} disabled={busy}>
            {busy ? "Unlocking…" : "Unlock with demo access"}
          </button>
        </>
      )}
    </div>
  );
}
