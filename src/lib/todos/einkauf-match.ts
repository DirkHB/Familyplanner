/**
 * Dieselbe Sache an zwei Orten wiedererkennen.
 *
 * „Abschiedsgeschenk für Regina kaufen" steht als Aufgabe — und derselbe
 * Vorgang liegt als „Abschiedsgeschenk für Regina" auf dem Einkaufszettel.
 * Wer die Aufgabe abhakt, hat auch den Einkauf erledigt; bleibt der Eintrag
 * offen, erzählt das Briefing am nächsten Morgen von etwas, das längst
 * gekauft ist. Genau das ist passiert.
 *
 * Der Abgleich ist bewusst streng: Lieber ein Treffer weniger als einmal den
 * falschen Artikel vom Zettel streichen. Deshalb kein unscharfer Abstand,
 * sondern ein klarer Vergleich der bedeutungstragenden Wörter.
 *
 * Reine Zeichenkettenlogik ohne Datenbank — damit die Grenzfälle prüfbar
 * bleiben (Regina ≠ Oma).
 */

/**
 * Wörter, die nichts über den Gegenstand sagen. „Geschenk kaufen" und
 * „Geschenk besorgen" meinen dasselbe; das Verb darf den Vergleich nicht
 * verwässern.
 */
const FUELLWOERTER = new Set([
  "kaufen", "besorgen", "holen", "abholen", "bestellen", "mitnehmen", "mitbringen",
  "einkaufen", "organisieren", "noch", "mal", "bitte", "und", "oder", "fuer", "vom",
  "von", "mit", "bei", "im", "in", "am", "an", "zum", "zur", "auf", "aus",
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer",
  "neu", "neue", "neuen", "neuer", "neues",
]);

/**
 * Umlaute und ß in die übliche Umschrift bringen, damit „Käfer" und „Kaefer"
 * dasselbe Wort sind — und „für" dasselbe wie „fuer", sonst rutscht es an der
 * Füllwort-Liste vorbei und zählt als Inhalt.
 */
function falte(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

/**
 * Grobe Grundform: hinten n/e/s abtragen, solange das Wort lang genug bleibt.
 * So treffen sich „Windeln" und „Windel", ohne dass „Regina" (endet auf a)
 * oder kurze Wörter wie „Eis" angetastet werden.
 */
function stamm(wort: string): string {
  let w = wort;
  while (w.length >= 5 && (w.endsWith("n") || w.endsWith("e") || w.endsWith("s"))) {
    w = w.slice(0, -1);
  }
  return w;
}

/** Die bedeutungstragenden Wörter eines Textes, entdoppelt. */
export function kernwoerter(text: string): Set<string> {
  return new Set(
    falte(text)
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 1 && !FUELLWOERTER.has(w))
      .map(stamm),
  );
}

/**
 * Meinen die beiden Texte dasselbe?
 *
 * Bedingungen, alle drei müssen halten:
 *   1. Die kleinere Wortmenge steckt vollständig in der größeren.
 *      („Windeln bestellen" ⊆ „Windeln")
 *   2. Sie deckt mindestens die Hälfte der größeren ab — sonst würde „Milch"
 *      einen Sammeleintrag „Milch, Butter, Eier, Brot" abhaken.
 *   3. Mindestens ein Wort ist lang genug, um wirklich etwas zu benennen.
 */
export function meintDasselbe(a: string, b: string): boolean {
  const wa = kernwoerter(a);
  const wb = kernwoerter(b);
  if (wa.size === 0 || wb.size === 0) return false;

  const [klein, gross] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  for (const w of klein) if (!gross.has(w)) return false;
  if (klein.size / gross.size < 0.5) return false;
  return [...klein].some((w) => w.length >= 4);
}

export type EinkaufKandidat = { id: string; text: string };

/**
 * Der beste offene Einkaufs-Eintrag zu einer gerade erledigten Aufgabe —
 * oder `null`. Bei mehreren Treffern gewinnt der knappste Eintrag: Er ist
 * am ehesten genau dieser eine Gegenstand.
 */
export function findeEinkaufTreffer<T extends EinkaufKandidat>(
  aufgabenTitel: string,
  offeneArtikel: T[],
): T | null {
  const treffer = offeneArtikel.filter((a) => meintDasselbe(aufgabenTitel, a.text));
  if (treffer.length === 0) return null;
  return treffer.reduce((best, a) => (a.text.length < best.text.length ? a : best));
}
