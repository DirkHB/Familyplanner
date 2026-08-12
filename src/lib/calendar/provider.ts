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
 * Ein Google-Kalender: lesen über die .ics-Adresse, schreiben über die API.
 *
 * Die beiden Hälften kommen aus verschiedenen Quellen, und das ist Absicht:
 * Googles CalDAV ist seit März 2025 tot, aber ein Feed kostet nichts und ist
 * sofort da. Geschrieben wird über die Kalender-API, die den Termin unter
 * derselben UID zurückgibt, unter der er später im Feed steht.
 */
export const GOOGLE_PROVIDER = "google";

/**
 * Kann die App in diesen Kalender schreiben?
 *
 * Ein Abonnement ist eine Einbahnstraße. Wer das nicht fragt, bietet ihn als
 * Schreibziel an — und der Termin, den jemand anlegt, verschwindet beim
 * nächsten Abgleich wieder, weil die Gegenseite nichts davon weiß.
 *
 * Ein Google-Kalender sieht beim Lesen aus wie ein Abonnement, ist aber
 * keines: Er hat einen Rückweg. Deshalb steht die Frage hier und nicht bei
 * „kommt es über einen Feed?".
 */
export function kannSchreiben(provider: string | null | undefined): boolean {
  return provider === ICLOUD_PROVIDER || provider === GOOGLE_PROVIDER;
}

/** Wird dieser Kalender über eine .ics-Adresse gelesen? */
export function liestUeberFeed(provider: string | null | undefined): boolean {
  return provider === ICS_PROVIDER || provider === GOOGLE_PROVIDER;
}
