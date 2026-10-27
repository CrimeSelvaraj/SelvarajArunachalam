"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SessionWatch } from "@/components/SessionWatch";
import { Notice } from "@/components/ui";
import { deviceHeaders } from "@/lib/device";

type PayConfig = {
  mode: "paypal" | "sandbox-stand-in";
  clientId: string | null;
};

type PayPalButtons = {
  render: (selector: string) => Promise<void>;
};

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError: () => void;
      }) => PayPalButtons;
    };
  }
}

export function PayScreen({ email }: { email: string }) {
  const router = useRouter();
  const [config, setConfig] = useState<PayConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    let stop = false;
    void (async () => {
      const response = await fetch("/api/pay/config", { cache: "no-store", headers: deviceHeaders() });
      if (stop) return;
      if (response.status === 401) {
        router.refresh();
        return;
      }
      const body = (await response.json()) as PayConfig;
      setConfig(body);
    })();
    return () => {
      stop = true;
    };
  }, [router]);

  useEffect(() => {
    if (!config || config.mode !== "paypal" || !config.clientId || started.current) return;
    const clientId = config.clientId;
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    script.async = true;
    script.onload = () => {
      if (!window.paypal || started.current) return;
      started.current = true;
      void window.paypal
        .Buttons({
          createOrder: async () => {
            const response = await fetch("/api/paypal/order", { method: "POST", headers: deviceHeaders() });
            const body = (await response.json()) as { id?: string; error?: string };
            if (!response.ok || !body.id) throw new Error(body.error ?? "PayPal did not start checkout.");
            return body.id;
          },
          onApprove: async (data) => {
            const response = await fetch("/api/paypal/capture", {
              method: "POST",
              headers: deviceHeaders(),
              body: JSON.stringify({ orderId: data.orderID }),
            });
            if (!response.ok) {
              const body = (await response.json().catch(() => null)) as { error?: string } | null;
              setError(body?.error ?? "PayPal did not confirm the $1 payment.");
              return;
            }
            router.refresh();
          },
          onError: () => setError("PayPal checkout did not finish."),
        })
        .render("#paypal-buttons");
    };
    script.onerror = () => setError("PayPal’s checkout script did not load.");
    document.body.appendChild(script);
  }, [config, router]);

  async function payLocally() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/pay/sandbox", { method: "POST", headers: deviceHeaders() });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "The payment was not recorded.");
        return;
      }
      router.refresh();
    } catch {
      setError("The payment was not recorded.");
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <main className="gate">
      <SessionWatch />
      <section className="gate-card">
        <p className="gate-kicker">ATOZ · {email}</p>
        <h1>Access is $1</h1>
        <p className="price">$1.00</p>
        <p>Paid once in USD. After this payment, the workshop opens on this system.</p>
        {!config ? <Notice tone="loading" title="Preparing checkout">Loading the $1 payment.</Notice> : null}
        {config?.mode === "paypal" ? (
          <>
            <p>Pay with PayPal. The charge is $1.00 USD. Sandbox keys stay in sandbox unless PAYPAL_ENV is set to live.</p>
            <div id="paypal-buttons" />
          </>
        ) : null}
        {config?.mode === "sandbox-stand-in" ? (
          <>
            <Notice tone="empty" title="PayPal keys are not configured">
              This screen is the PayPal sandbox path. Leave PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET blank to use the
              stand-in, or set both from a sandbox app at developer.paypal.com. No live secret is built into this app.
              The button records a local paid state for {email}. A verified event at POST /api/paypal/webhook replaces
              that state once PAYPAL_WEBHOOK_ID is set.
            </Notice>
            <button className="btn primary" type="button" disabled={pending} onClick={() => void payLocally()}>
              {pending ? "Recording" : "Record $1 paid"}
            </button>
          </>
        ) : null}
        {error ? <Notice tone="error" title="Payment needs another try">{error}</Notice> : null}
        <button className="btn quiet" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </section>
    </main>
  );
}
