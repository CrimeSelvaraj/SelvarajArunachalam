import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Chrome } from "@/components/Chrome";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LOOP READ",
    template: "%s · LOOP READ",
  },
  description: "Read Faster...Think Smarter. A speed reader for files you already own.",
  applicationName: "LOOP READ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3eee4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}
