/**
 * Woher ein Kalender kommt.
 *
 * Die Spalte `provider` gab es immer, stand aber überall fest auf „icloud" —
 * eine Frage, die sich nie stellte. Jetzt stellt sie sich, und deshalb steht
 * die Antwort an einer Stelle statt an sieben.
 */

/** iCloud über CalDAV: lesen und schreiben. */
export const ICLOUD_PROVIDER = "icloud";

/** Ein Abonnement auf eine .ics-Adresse: nur lesen. */
export const ICS_PROVIDER = "ics";

/**
 * Kann die App in diesen Kalender schreiben?
 *
 * Ein Abonnement ist eine Einbahnstraße. Wer das nicht fragt, bietet ihn als
 * Schreibziel an — und der Termin, den jemand anlegt, verschwindet beim
 * nächsten Abgleich wieder, weil die Gegenseite nichts davon weiß.
 */
export function kannSchreiben(provider: string | null | undefined): boolean {
  return provider === ICLOUD_PROVIDER;
}
