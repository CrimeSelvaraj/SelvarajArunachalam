# ATOZ

ATOZ is a workshop for making things, from a first sentence to a finished piece. One web app, and the same app as an installable shell for iOS and Android.

**Tagline:** The whole alphabet of making, on one bench.

Open a bench, run its action, and see a result in the browser. Portrait playback, voice, node graphs, votes, studios, jobs, and PDF reading are on-device previews. They are not the full upstream engines. This repo does not submit anything to an app store.

## Web

From the repo root, with [pnpm](https://pnpm.io) available:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

`pnpm dev` starts the Next.js app. Sign in with an email, then pay $1, before any bench is shown. The same build is what you point a domain at:

```bash
pnpm build
pnpm start
```

`pnpm start` listens on port 3000. Point the domain at that process (or at the host in front of it). There is no separate static export: sign-in, the payment, and the one-device rule need the server.

## Sign in, $1, and one device

Email is the account. The first system to sign in with that email gets the session. A desktop and a phone cannot stay signed in together. A second system does not receive the session. It is asked for a six-digit code. The code is emailed when `RESEND_API_KEY` and `EMAIL_FROM` are set. The same code can be texted when `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM` are set; the challenge screen has a phone field for that. Entering the code moves the session and signs the previous system out.

Access costs **$1.00 USD**, once per email.

PayPal is sandbox unless `PAYPAL_ENV=live`. Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from a sandbox app if you want the real PayPal button. This repo does not contain a live PayPal secret. When those two values are blank, the pay screen says so and **Record $1 paid** writes a local paid state (`paymentRef: "local-sandbox"`) for that email. Nothing is charged.

`POST /api/paypal/webhook` is the replacement for that local state. It marks the email paid only after PayPal verifies a `PAYMENT.CAPTURE.COMPLETED` event for $1.00 USD. Until `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_WEBHOOK_ID` are all set, the webhook answers 503 and does not change anyone’s access.

Copy `.env.example` to `apps/web/.env.local` and fill only the values you have. Leave the rest blank.

Without an email provider, the six-digit code is printed in the `pnpm dev` terminal and shown on the new device so the local challenge can be completed. That on-screen code is the stand-in, not proof of mailbox ownership. With Resend configured, the code is only in the email.

## Mobile

iOS and Android are a Capacitor shell that loads this site, so the phone hits the same sign-in and payment. The native projects live in `apps/web/ios` and `apps/web/android`. You need macOS with Xcode for iOS, or Android Studio for Android.

```bash
pnpm dev
```

In another terminal, point the shell at the running site and sync:

```bash
CAPACITOR_SERVER_URL=http://localhost:3000 pnpm cap:sync
pnpm cap:ios       # opens Xcode
pnpm cap:android   # opens Android Studio
```

Use `http://localhost:3000` on a simulator. A phone on the same network needs this computer’s LAN address, with `cleartext` already enabled for `http://` URLs. For a domain, set `CAPACITOR_SERVER_URL` to `https://your.domain` and sync again.

A phone browser can also open http://localhost:3000 (or the domain) and use Add to Home Screen. It is the same screens.

## What these previews do not do

Speech uses the device speech engine and, if you allow it, the microphone. Files you open in RevPDF stay in the browser. Nothing in these benches is sent to a model host. Sign-in and the $1 payment are the exception: they are checked by this site’s server.

- HeyGem plays a portrait and, when the device can, speaks the line. It does not render a video avatar.
- OmniVoice stores a pitch and pace from your sample. It is not a neural voice clone.
- ComfyUI here is a small node canvas. It does not run the ComfyUI engine.
- Pinocchio sets joint angles and plays a pose. It is not a physics solver.
- RevPDF reads text files, and PDFs whose letters are stored as plain text. Compressed or scanned PDFs show an error instead of a blank page.

`apps/api` is an earlier FastAPI stub and is not used by ATOZ.
