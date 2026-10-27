import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Shell } from "@/components/Shell";
import { StoreProvider } from "@/components/StoreProvider";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ATOZ",
    template: "%s · ATOZ",
  },
  description: "The whole alphabet of making, on one bench.",
  applicationName: "ATOZ",
  appleWebApp: {
    capable: true,
    title: "ATOZ",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3ecdf",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}
