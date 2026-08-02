import Link from "next/link";

/**
 * Eigene 404-Seite.
 *
 * Ohne sie zeigt Next seine nackte englische Standardseite — mitten in einer
 * deutschen App, ohne Weg zurück. Das passiert im Alltag leicht: ein Termin
 * wird in Apple Kalender gelöscht, und ein Link darauf ist noch offen.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg px-8 text-center text-ink">
      <div>
        <p className="font-display text-3xl leading-tight">Das gibt es nicht mehr</p>
        <p className="mt-3 text-ink-muted">
          Wahrscheinlich wurde der Termin gelöscht oder verschoben.
        </p>
      </div>
      <Link
        href="/woche"
        className="rounded-pill bg-accent px-6 py-3 font-medium text-surface"
      >
        Zur Woche
      </Link>
    </div>
  );
}
