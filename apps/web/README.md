# ATOZ web

Next.js app for the ATOZ workshop. Sign-in, the $1 payment, and the one-device rule run in this server.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

Production, the process a domain should point at:

```bash
pnpm build
pnpm start
```

The phone shell loads that same origin. From the repo root:

```bash
CAPACITOR_SERVER_URL=http://localhost:3000 pnpm cap:sync
```

See the repository README for PayPal’s sandbox stand-in, the six-digit takeover code, and the mobile steps.
