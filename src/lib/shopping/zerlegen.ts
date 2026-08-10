/**
 * Aus einem Textfeld werden einzelne Artikel.
 *
 * „Tomaten, Käse, Brot" sind drei Dinge, nicht eins. Wer schnell tippt,
 * schreibt sie in eine Zeile; wer aus einer Notiz kopiert, hat sie
 * untereinander, oft mit Strichen oder Häkchen davor. Beides soll ankommen.
 *
 * Diese Datei rechnet ohne KI. Das ist Absicht: Das Zerlegen ist der Schritt,
 * an dem der Einkauf entsteht — er darf nicht davon abhängen, dass ein
 * fremder Dienst gerade antwortet. Die KI räumt hinterher auf (siehe
 * lib/ai/einkauf-zerlegen.ts), aber sie ist die Kür, nicht die Pflicht.
 */

/** Häkchen, Striche, Aufzählungszeichen und Nummerierungen am Zeilenanfang. */
const VORSPANN = /^\s*(?:[-–—•*·▪◦]|\[[ xX]?\]|\d+[.)])\s*/;

/**
 * Ein Komma trennt Artikel — außer es steht zwischen zwei Ziffern.
 *
 * „Milch 1,5 %" ist ein Artikel. Ohne diese Ausnahme wären es zwei, und der
 * zweite hieße „5 %". Genau solche Reste stehen dann wochenlang auf der
 * Liste, weil niemand weiß, was sie bedeuten.
 */
function trenneKommas(zeile: string): string[] {
  return zeile.split(/(?<!\d)\s*[,;]\s*(?!\d)/);
}

/** Doppelte Leerzeichen weg, Ränder sauber. */
function glaetten(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Der ganze Text zu einer Liste von Artikeln.
 *
 * Reihenfolge wie eingegeben, Doppelte fallen weg (ohne Rücksicht auf Groß-
 * und Kleinschreibung — „Brot" und „brot" sind dasselbe Brot).
 */
export function zerlegeEinkauf(text: string, maxLaenge = 120): string[] {
  const gesehen = new Set<string>();
  const artikel: string[] = [];

  for (const rohzeile of (text ?? "").split(/\r?\n/)) {
    const zeile = rohzeile.replace(VORSPANN, "");
    for (const stueck of trenneKommas(zeile)) {
      const sauber = glaetten(stueck).slice(0, maxLaenge);
      if (!sauber) continue;
      const schluessel = sauber.toLowerCase();
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      artikel.push(sauber);
    }
  }

  return artikel;
}

/**
 * Wie viele Artikel eine Eingabe auf einmal enthalten darf.
 *
 * Nicht als Schikane, sondern weil ein versehentlich hineinkopierter Roman
 * sonst hundert Zeilen anlegt, die jemand einzeln wieder wegräumen muss.
 */
export const MAX_ARTIKEL = 40;

/**
 * Was von einer KI-Antwort übrig bleiben darf.
 *
 * Eine Antwort ist etwas, das jemand anderes geschickt hat. Sie darf nichts
 * anlegen, was niemand eingetippt hat, und nichts, das keine Zeichenkette ist
 * — sonst steht irgendwann `[object Object]` auf dem Einkaufszettel.
 */
export function saeubere(wert: unknown): string[] {
  if (!Array.isArray(wert)) return [];
  const gesehen = new Set<string>();
  const raus: string[] = [];
  for (const eintrag of wert) {
    if (typeof eintrag !== "string") continue;
    const sauber = eintrag.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!sauber) continue;
    const schluessel = sauber.toLowerCase();
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    raus.push(sauber);
    if (raus.length >= MAX_ARTIKEL) break;
  }
  return raus;
}
