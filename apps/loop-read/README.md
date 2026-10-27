# LOOP READ

Read Faster...Think Smarter.

A small web app for speed-reading files you already own. It is a separate Next.js app in this monorepo (`apps/loop-read`). It does not share the ProofPress API, and it does not search for or download books.

## Install and run

Requirements: Node 22+ and pnpm.

```bash
cd apps/loop-read
pnpm install
pnpm dev
```

Open http://localhost:3000

ProofPress (`apps/web`) also defaults to port 3000. Run one of them at a time, or start LOOP READ on another port:

```bash
pnpm exec next dev --turbopack -p 3210
```

Production mode, still local:

```bash
pnpm build
pnpm start
```

Accounts, sessions, and extracted book text are stored on disk in `apps/loop-read/data/` (gitignored). One Node process is assumed. The original upload is not kept — only the extracted words.

## What works

1. **Email sign-in.** First use of an email creates the account and a session (httpOnly cookie, 14 days). There is no password.
2. **One active session per email.** If that email already has a live session, the next sign-in must enter a six-digit code. A correct code moves the session to this browser and signs the other one out.
3. **Access fee of 1 USD.** The Access page is the checkout. With PayPal credentials, it creates a PayPal order and returns to confirm a captured 1.00 USD payment. Without credentials, a labeled demo unlock opens the library with no charge.
4. **Library.** Upload `.txt`, `.epub`, or `.pdf` (8 MB, up to 200,000 words). Plain text is read in full. EPUB text is taken from the spine. PDF text is extracted when the file has a real text layer. Scans, locked EPUBs, and other files that yield no words are refused with a message to convert a copy you own.
5. **Speed reader.** Sample drill plus any uploaded book. Pace is 1.5×, 2×, or 3× a 200 WPM baseline (300, 400, or 600 WPM). Flash one word, two words, or a short group of three. Start, pause, and a words-per-minute readout. Space also starts and pauses.
6. **Badge.** Reaching the last word awards a single “Loop closed” badge for that book.

## Demo vs real

Copy `apps/loop-read/.env.example` to `apps/loop-read/.env.local`. Do not commit `.env.local`.

| Feature | Without secrets | With secrets |
| --- | --- | --- |
| Sign-in code | **Demo sender.** The code is printed in the server log as `[LOOP READ demo email]`. On `pnpm dev` it is also shown in a banner on the sign-in page. Nothing is emailed. | Set `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` (optional `SMTP_PORT`, `SMTP_FROM`). The code is emailed and is not shown in the page or the log. |
| 1 USD access | **Demo checkout.** The Access page explains that PayPal is not configured and offers **Unlock with demo access**. | Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. `PAYPAL_MODE=sandbox` (default) or `live`. The demo button is hidden. Checkout uses the PayPal Orders API for 1.00 USD and unlocks only after a completed capture. |

`LOOP_READ_SHOW_DEMO_CODE=1` forces the on-screen code even in production. Use that only on your own machine, never on a public host.

`LOOP_READ_COOKIE_SECURE=1` marks the session cookie Secure. Leave it unset for local HTTP.

Sandbox PayPal apps: https://developer.paypal.com/dashboard/applications

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

With the dev server running (`BASE_URL` defaults to http://127.0.0.1:3210):

```bash
pnpm exec next dev --turbopack -p 3210
node scripts/smoke.mjs
```

That walks sign-in, demo unlock, txt/epub/pdf upload, the second-session code, and the badge API.
