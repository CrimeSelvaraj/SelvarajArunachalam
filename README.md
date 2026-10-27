# ATOZ

ATOZ is a workshop for making things, from a first sentence to a finished piece. One web app, and the same app as an installable shell for iOS and Android.

**Tagline:** The whole alphabet of making, on one bench.

Open a bench, run its action, and see a result in the browser. Portrait playback, voice, node graphs, votes, studios, jobs, and PDF reading are on-device previews. They are not the full upstream engines. This repo does not submit anything to an app store.

## Web

From the repo root, with [pnpm](https://pnpm.io) available:

```bash
cd apps/web
pnpm install
pnpm dev
```

Open http://localhost:3000

Production build (also `npm run build` from the repo root):

```bash
cd apps/web
pnpm build
```

The static site is written to `apps/web/out`.

## Mobile

iOS and Android are a Capacitor shell around that static site. The native projects live in `apps/web/ios` and `apps/web/android`. You need macOS with Xcode for iOS, or Android Studio for Android.

```bash
cd apps/web
pnpm install
pnpm cap:sync
pnpm cap:ios       # opens Xcode
pnpm cap:android   # opens Android Studio
```

Run the ATOZ target on a simulator or a device from Xcode or Android Studio.

A phone browser can also open the site full screen (Add to Home Screen). It is the same screens, sized for a thumb.

## What these previews do not do

Speech uses the device speech engine and, if you allow it, the microphone. Files you open in RevPDF stay in the browser. Nothing in these benches is sent to a model host.

- HeyGem plays a portrait and, when the device can, speaks the line. It does not render a video avatar.
- OmniVoice stores a pitch and pace from your sample. It is not a neural voice clone.
- ComfyUI here is a small node canvas. It does not run the ComfyUI engine.
- Pinocchio sets joint angles and plays a pose. It is not a physics solver.
- RevPDF reads text files, and PDFs whose letters are stored as plain text. Compressed or scanned PDFs show an error instead of a blank page.

`apps/api` is an earlier FastAPI stub and is not used by ATOZ.
