import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

// Selbst gehostete Fonts (Fontsource, OFL) — keine externen CDN-Aufrufe.
import "@fontsource-variable/fraunces";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource/instrument-serif";

import "./globals.css";

export const metadata: Metadata = {
  title: "Familienplaner",
  description: "Unser gemeinsamer Plan — für Constanze und Dirk.",
  applicationName: "Familienplaner",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Plan",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
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
  // Wie bei nativen Apps: kein Hineinzoomen. Sonst wird der ganze Bildschirm
  // nach einem versehentlichen Doppeltipp seitlich verschiebbar.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={GeistSans.variable} suppressHydrationWarning>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
