"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./screens.module.css";

type StartResponse = {
  status?: "signed_in" | "code_required";
  paid?: boolean;
  demo?: boolean;
  devCode?: string;
  error?: string;
};

export function LoginForm({ replaced = false }: { replaced?: boolean }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [demo, setDemo] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function go(paid: boolean | undefined) {
    router.refresh();
    router.push(paid ? "/library" : "/access");
  }

  async function start(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json()) as StartResponse;
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not start sign-in.");
      return;
    }
    if (data.status === "signed_in") {
      go(data.paid);
      return;
    }
    setStep("code");
    setDemo(Boolean(data.demo));
    setDevCode(data.devCode ?? null);
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = (await res.json()) as StartResponse;
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "That code was not accepted.");
      return;
    }
    go(data.paid);
  }

  return (
    <div className={styles.form}>
      {replaced ? (
        <p className={styles.status} role="status">
          You were signed out because this email signed in on another device.
        </p>
      ) : null}
      {error ? (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      ) : null}

      {step === "email" ? (
        <form className={styles.form} onSubmit={(event) => void start(event)}>
          <label className={styles.field}>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button className={styles.primary} type="submit" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
          <p className={styles.hint}>
            The first sign-in on an email opens a session. If that email is already in use, LOOP READ asks for a
            six-digit code and then signs out the other session.
          </p>
        </form>
      ) : (
        <form className={styles.form} onSubmit={(event) => void verify(event)}>
          <p className={styles.note}>
            This email already has an active session. Enter the six-digit code to move the session to this browser.
            The other session will be signed out.
          </p>
          {demo ? (
            <div className={styles.banner} role="status">
              <strong>Demo sender.</strong>
              <p>
                No email was sent. {devCode
                  ? "This local development server is showing the code below. It is also printed in the server log."
                  : "Read the six-digit code from the server log, then enter it here."}
              </p>
              {devCode ? <p className={styles.codeDigits}>{devCode}</p> : null}
            </div>
          ) : (
            <p className={styles.note}>A six-digit code was sent to {email}. It expires in 10 minutes.</p>
          )}
          <label className={styles.field}>
            Six-digit code
            <input
              className={styles.code}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          <div className={styles.inline}>
            <button className={styles.primary} type="submit" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <button className={styles.secondary} type="button" disabled={busy} onClick={() => void start()}>
              Send a new code
            </button>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setDevCode(null);
                setError(null);
              }}
            >
              Use a different email
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
