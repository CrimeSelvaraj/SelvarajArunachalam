import type { Metadata } from "next";
import { Newsreader, Sora } from "next/font/google";
import { SiteChrome } from "@/components/SiteChrome";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProofPress — Scholarly news, grounded",
  description:
    "Enter a research topic. ProofPress searches open scholarship and drafts a readable scholarly news article with transparent sourcing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${sora.variable}`}>
      <body
        style={
          {
            ["--font-display" as string]: "var(--font-newsreader), serif",
            ["--font-sans" as string]: "var(--font-sora), sans-serif",
          } as React.CSSProperties
        }
      >
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
