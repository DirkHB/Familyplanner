/**
 * Geburtstage rechtzeitig — nicht erst am Tag selbst.
 *
 * Ein Geburtstag im Kalender erinnert bisher am Morgen daran, zu gratulieren.
 * Das ist genau einen Tag zu spät für alles, was man noch besorgen müsste.
 *
 * Deshalb ein paar Tage vorher genau eine Frage: Braucht es ein Geschenk? Bei
 * Ja entsteht eine Aufgabe mit Fälligkeit vor dem Geburtstag, bei Nein wird
 * die Frage für diese Person nie wieder gestellt — bei vierzig Einträgen aus
 * dem Adressbuch wäre sie sonst eine Zumutung.
 *
 * Hier steht bewusst keine KI. Erkennen, rechnen, fragen: Das kann nicht
 * danebengehen, und der ganze Nutzen der Idee steckt darin. Was ein gutes
 * Geschenk wäre, ist eine andere Frage — und eine, die schlecht rät, wer die
 * Person nicht kennt.
 */

/** Wie viele Tage vorher gefragt wird. */
export const VORLAUF_TAGE = 3;

/** Erkennt einen Geburtstagseintrag. */
export function istGeburtstag(titel: string): boolean {
  return /geburtstag/i.test(titel);
}

/**
 * Wessen Geburtstag — aus den Schreibweisen, die Kalender tatsächlich
 * erzeugen.
 *
 * Apple schreibt „Omas Geburtstag", Google „Oma hat Geburtstag", von Hand
 * angelegt wird meist „Geburtstag Oma". Findet sich kein Name, geben wir
 * keinen zurück: Ein falsch geratener Name in einer Frage ist schlimmer als
 * gar keiner.
 */
export function personAusTitel(titel: string): string | null {
  const t = titel.replace(/[🎂🎉🎁]/gu, "").trim();

  const muster: RegExp[] = [
    /^(.+?)\s+hat\s+Geburtstag\b/i, // Oma hat Geburtstag
    /^(.+?)['’]?s\s+Geburtstag\b/i, // Omas Geburtstag / Kim's Geburtstag
    /^Geburtstag\s*(?:von|:)\s*(.+)$/i, // Geburtstag von Oma / Geburtstag: Oma
    /^Geburtstag\s+(.+)$/i, // Geburtstag Oma
  ];

  for (const m of muster) {
    const treffer = t.match(m);
    const name = treffer?.[1]?.trim().replace(/[.,;]+$/, "");
    // „Geburtstagsfeier" & Co. laufen sonst als Name durch.
    if (name && name.length >= 2 && !/geburtstag/i.test(name)) return name;
  }
  return null;
}

/** Wie die Frage lautet. */
export function geschenkFrage(person: string | null, titel: string): string {
  return person
    ? `${person} hat bald Geburtstag. Soll ich eine Aufgabe fürs Geschenk anlegen?`
    : `„${titel}" steht an. Soll ich eine Aufgabe fürs Geschenk anlegen?`;
}

/** Wie die Aufgabe heißt, die bei „Ja" entsteht. */
export function geschenkAufgabe(person: string | null, titel: string): string {
  return person ? `Geschenk für ${person} besorgen` : `Geschenk besorgen: ${titel}`;
}

/**
 * Wann die Aufgabe fällig ist: der Tag vor dem Geburtstag.
 *
 * Nicht am Geburtstag selbst — dann stünde sie neben dem Anlass und wäre
 * nutzlos. Ein Tag Luft ist das Mindeste, damit „besorgen" noch etwas heißt.
 */
export function faelligFuer(geburtstag: Date): Date {
  return new Date(geburtstag.getTime() - 86_400_000);
}

/**
 * Ist dieser Geburtstag jetzt dran zum Fragen?
 *
 * Nur im Fenster davor. Am Tag selbst nicht mehr — dann ist die Frage nach
 * einem Geschenk keine Hilfe mehr, sondern ein Vorwurf.
 */
export function istImFragefenster(geburtstag: Date, jetzt: Date, vorlauf = VORLAUF_TAGE): boolean {
  const tage = Math.round((geburtstag.getTime() - jetzt.getTime()) / 86_400_000);
  return tage >= 1 && tage <= vorlauf;
}
