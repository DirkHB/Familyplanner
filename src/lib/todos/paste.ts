/**
 * Eine eingefügte Liste in Aufgabentitel zerlegen.
 *
 * Der verlässliche Weg aus Apple Erinnerungen heraus: Liste öffnen, alle
 * markieren, kopieren, hier einfügen. Apple gibt modernisierte Listen über
 * CalDAV nicht mehr heraus — dieser Weg hier hängt an nichts außer der
 * Zwischenablage und funktioniert damit auch aus jeder anderen App.
 *
 * Reine Zeichenkettenlogik, damit die Zerlegung prüfbar ist.
 */

/** Obergrenze je Einfügung — weit über jeder echten Haushaltsliste. */
export const MAX_ZEILEN = 300;

/** Führende Aufzählungszeichen, Nummerierungen und Checkbox-Reste. */
const PREFIX = /^\s*(?:[-*•◦▪·–—>]+|\d{1,3}[.)]|\[[ xX]?\]|[☐☑✓✔])\s*/;

export function parsePastedTasks(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rohzeile of text.split(/\r?\n/)) {
    // Mehrere Zeichen hintereinander („- [ ] …") — so oft schälen, bis nichts
    // mehr abgeht.
    let zeile = rohzeile;
    let vorher = "";
    while (vorher !== zeile) {
      vorher = zeile;
      zeile = zeile.replace(PREFIX, "");
    }
    const titel = zeile.trim().replace(/\s+/g, " ");
    if (!titel) continue;
    // Reine Zeichenreste („---", „***") sind keine Aufgabe.
    if (!/[\p{L}\p{N}]/u.test(titel)) continue;
    const key = titel.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(titel);
    if (out.length >= MAX_ZEILEN) break;
  }
  return out;
}
