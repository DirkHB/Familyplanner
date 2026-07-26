import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";

// Selbst gehostete Fonts (Fontsource, OFL) — keine externen CDN-Aufrufe.
import "@fontsource-variable/fraunces";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource/instrument-serif";

import "./globals.css";

export const metadata: Metadata = {
  title: "Familienplaner",
  description: "Unser gemeinsamer Plan — für Dirk und Constanze.",
  applicationName: "Familienplaner",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Plan",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5EFE6" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1A2E" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={GeistSans.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
