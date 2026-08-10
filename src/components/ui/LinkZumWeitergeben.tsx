"use client";

import { useState } from "react";

/**
 * Der Einladungslink zum Weitergeben.
 *
 * Er steht hier, weil eine Mail viele Wege hat, nicht anzukommen: Spam,
 * Tippfehler in der Adresse, ein Postfach, das gerade nichts annimmt. Bisher
 * war der Link in dem Moment verloren, in dem der Versand schiefging — in der
 * Datenbank steht nur sein Abdruck, wiederherstellen kann ihn niemand.
 *
 * Jetzt steht er einmal da. Danach nie wieder: Er ist ein Zugang, und ein
 * Zugang gehört nicht auf eine Seite, die man später noch einmal aufruft.
 */
export function LinkZumWeitergeben({ link, hinweis }: { link: string; hinweis?: string }) {
  const [kopiert, setKopiert] = useState(false);

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(link);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      // Ohne Zwischenablage (älteres iOS, kein HTTPS) bleibt der Text zum
      // Markieren stehen — deshalb steht er überhaupt sichtbar da.
    }
  }

  return (
    <div className="mt-3 rounded-card bg-bg p-3">
      {hinweis && <p className="mb-2 text-sm text-ink-muted">{hinweis}</p>}
      <p className="break-all font-mono text-xs text-ink-muted">{link}</p>
      <button
        type="button"
        onClick={kopieren}
        className="mt-2 rounded-pill border border-ink-muted/30 px-3 py-1.5 text-xs font-medium text-ink"
      >
        {kopiert ? "Kopiert ✓" : "Link kopieren"}
      </button>
    </div>
  );
}
