"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore, useState } from "react";
import { Notice } from "@/components/ui";
import { currentDevice } from "@/lib/device";

const noticeListeners = new Set<() => void>();

function loadNotice(): string | null {
  return sessionStorage.getItem("atoz.notice");
}

function clearNotice() {
  sessionStorage.removeItem("atoz.notice");
  for (const listener of noticeListeners) listener();
}

function subscribeNotice(listener: () => void) {
  noticeListeners.add(listener);
  return () => noticeListeners.delete(listener);
}

type Challenge = {
  email: string;
  otherKind: "desktop" | "phone";
  previewCode: string | null;
};

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [smsNote, setSmsNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const notice = useSyncExternalStore(subscribeNotice, loadNotice, () => null);

  async function onLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotice();
    setError(null);
    setPending(true);
    try {
      const device = currentDevice();
      const response = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, deviceId: device.id, kind: device.kind }),
      });
      const body = (await response.json()) as {
        error?: string;
        status?: string;
        otherKind?: "desktop" | "phone";
        previewCode?: string | null;
      };
      if (!response.ok) {
        setError(body.error ?? "Sign-in did not go through.");
        return;
      }
      if (body.status === "code-required") {
        setChallenge({
          email: email.trim().toLowerCase(),
          otherKind: body.otherKind === "phone" ? "phone" : "desktop",
          previewCode: body.previewCode ?? null,
        });
        return;
      }
      router.refresh();
    } catch {
      setError("Sign-in did not go through. Check that this site is running and try again.");
    } finally {
      setPending(false);
    }
  }

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    setError(null);
    setPending(true);
    try {
      const device = currentDevice();
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: challenge.email, deviceId: device.id, code }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "That code did not work.");
        return;
      }
      router.refresh();
    } catch {
      setError("The code could not be checked. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function onText() {
    if (!challenge) return;
    setError(null);
    setSmsNote(null);
    setPending(true);
    try {
      const device = currentDevice();
      const response = await fetch("/api/auth/sms", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: challenge.email, deviceId: device.id, phone }),
      });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(body.error ?? "The text could not be sent.");
        return;
      }
      setSmsNote(body.message ?? "The number was saved.");
    } catch {
      setError("The text could not be sent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="gate">
      <section className="gate-card">
        <p className="gate-kicker">ATOZ</p>
        {challenge ? (
          <>
            <h1>Move the session</h1>
            <p>
              {challenge.email} is already signed in on a {challenge.otherKind}. A new sign-in does not share that
              session. Enter the six-digit code sent to that email. The other system is signed out when the code
              matches.
            </p>
            {challenge.previewCode ? (
              <Notice tone="empty" title="Email provider is not configured">
                This local run is showing the code because nothing is set up to send mail. It is the same code written
                to the server log. Set RESEND_API_KEY and EMAIL_FROM to send it to the mailbox instead.
                <span className="code-preview">{challenge.previewCode}</span>
              </Notice>
            ) : (
              <Notice tone="empty" title="Code sent">Check {challenge.email} for the six digits. They expire in 10 minutes.</Notice>
            )}
            <form onSubmit={(event) => void onVerify(event)}>
              <label className="field">
                <span>Six-digit code</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="\d{6}"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
              </label>
              <label className="field">
                <span>Phone number</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+1 555 010 0148"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <small>The same code can be sent by text when a provider is configured.</small>
              </label>
              <div className="form-actions">
                <button className="btn" type="button" disabled={pending || phone.trim().length < 8} onClick={() => void onText()}>
                  Text the code
                </button>
                <button className="btn primary" type="submit" disabled={pending || code.length !== 6}>
                  {pending ? "Checking" : "Take over this system"}
                </button>
              </div>
            </form>
            {smsNote ? <Notice tone="empty" title="Text">{smsNote}</Notice> : null}
            <button
              className="btn quiet"
              type="button"
              onClick={() => {
                setChallenge(null);
                setCode("");
                setError(null);
                setSmsNote(null);
              }}
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
            <h1>Sign in</h1>
            <p>Use your email. Access is $1, paid once. That email stays active on one system at a time, a desktop or a phone.</p>
            {notice ? <Notice tone="empty" title="Signed out">{notice}</Notice> : null}
            <form onSubmit={(event) => void onLogin(event)}>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <button className="btn primary" type="submit" disabled={pending}>
                {pending ? "Checking" : "Continue"}
              </button>
            </form>
          </>
        )}
        {error ? <Notice tone="error" title="Try again">{error}</Notice> : null}
      </section>
    </main>
  );
}
