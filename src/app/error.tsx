"use client";

import Link from "next/link";

/**
 * Wenn eine Seite nicht gerechnet werden kann.
 *
 * Ohne diese Datei zeigt Next.js seinen eigenen Notfall: eine weiße Seite mit
 * „Application error: a server-side exception has occurred" und einer Zahl.
 * Für zwei Menschen, die wissen wollen, wer heute Nachmittag bei Nicolas ist,
 * sieht das aus, als wäre alles kaputt — dabei ist es meist eine einzelne
 * Seite.
 *
 * Also: sagen, was los ist, einen Weg weiter anbieten, und die Kennung
 * mitgeben. Über die findet sich der Fehler im Server-Log wieder; ohne sie
 * sucht man ihn zwischen tausend Zeilen.
 */
export default function Fehlerseite({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-dvh bg-bg px-6 py-16 text-ink">
      <div className="mx-auto flex max-w-sm flex-col items-start gap-5">
        <h1 className="font-display text-3xl leading-tight">Das hat gerade nicht geklappt</h1>
        <p className="text-ink-muted">
          Diese Seite ließ sich nicht laden. An euren Daten liegt es nicht — die stehen alle
          noch da, wo sie hingehören.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={reset}
            className="rounded-pill bg-accent px-5 py-3 font-medium text-surface"
          >
            Nochmal versuchen
          </button>
          <Link
            href="/woche"
            className="rounded-pill bg-surface px-5 py-3 font-medium text-ink shadow-card"
          >
            Zur Woche
          </Link>
        </div>
        {error.digest && (
          /* Die Brücke ins Server-Log: Dort steht dieselbe Kennung neben dem
             echten Fehler. Ohne sie sucht man ihn zwischen tausend Zeilen. */
          <p className="font-mono text-xs text-ink-muted">Kennung: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
