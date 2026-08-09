import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { HaushaltProvider, type HaushaltNamen } from "@/components/app/HaushaltContext";
import { haushaltProfil } from "@/lib/haushalt/profil";
import { PLATZ_A, PLATZ_B } from "@/lib/haushalt/platz";

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

/**
 * Die Namen des Haushalts, einmal je Aufruf.
 *
 * Bewusst mit Netz: Ohne das `catch` risse ein Datenbank-Hänger — ein
 * Neon-Kaltstart reicht — die Anmeldeseite mit ab, und dann kommt niemand mehr
 * rein, um das Problem zu sehen. Kurz zwischengespeichert ist es ohnehin, das
 * hier ist also höchstens alle fünf Minuten eine Abfrage.
 */
async function namenDesHaushalts(): Promise<HaushaltNamen> {
  try {
    const profil = await haushaltProfil();
    const namen: HaushaltNamen = { [PLATZ_A]: "", [PLATZ_B]: "" };
    for (const e of profil.erwachsene) namen[e.slot] = e.name;
    return namen;
  } catch {
    return { [PLATZ_A]: "", [PLATZ_B]: "" };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const namen = await namenDesHaushalts();
  return (
    <html lang="de" className={GeistSans.variable} suppressHydrationWarning>
      <body>
        <HaushaltProvider namen={namen}>{children}</HaushaltProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
