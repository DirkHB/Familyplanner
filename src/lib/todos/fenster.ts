import type { FreiBlock } from "@/lib/calendar/zeitstrahl";

/**
 * Wann der tägliche Aufgaben-Anstoß kommt.
 *
 * Nicht morgens um neun, wenn ohnehin der Tag losgeht — sondern in dem
 * Moment, in dem tatsächlich Luft ist. Eine Erinnerung, die man gerade nicht
 * befolgen kann, ist eine Erinnerung zu viel; genau daran nutzt man solche
 * Apps irgendwann nicht mehr.
 *
 * Reine Logik ohne Datenbank und ohne Uhr — der Worker gibt „jetzt" herein.
 */

/** So lange vorher darf angestoßen werden, damit man ankommt, bevor es losgeht. */
export const VORLAUF_MINUTEN = 15;

/** Kürzere Reste sind kein Fenster mehr, auch wenn der Block groß war. */
export const MIN_REST_MINUTEN = 30;

export type FensterWahl =
  | { art: "fenster"; block: FreiBlock }
  /** Der Tag gab nichts her — trotzdem einmal Bescheid geben, bevor er endet. */
  | { art: "tagesende" }
  | { art: "warten" };

/**
 * Welches Fenster passt jetzt?
 *
 * Drei Fälle, in dieser Reihenfolge:
 *   1. Ein freier Block läuft gerade und hat noch genug Rest → jetzt.
 *   2. Ein freier Block beginnt gleich → jetzt, mit kurzem Vorlauf.
 *   3. Der Tag neigt sich und es kam nie ein Fenster → einmal ohne Vorschlag.
 */
export function waehleFenster(
  bloecke: FreiBlock[],
  now: Date,
  tagesEnde: Date,
): FensterWahl {
  for (const b of bloecke) {
    const laeuft = b.von <= now && now < b.bis;
    if (laeuft && (b.bis.getTime() - now.getTime()) / 60_000 >= MIN_REST_MINUTEN) {
      return { art: "fenster", block: b };
    }
    const bisStart = (b.von.getTime() - now.getTime()) / 60_000;
    if (bisStart > 0 && bisStart <= VORLAUF_MINUTEN) return { art: "fenster", block: b };
  }

  // Letzte Stunde des Tagesfensters: Der versprochene tägliche Anstoß darf
  // nicht ausfallen, nur weil der Tag voll war.
  const restTag = (tagesEnde.getTime() - now.getTime()) / 60_000;
  if (restTag > 0 && restTag <= 60) return { art: "tagesende" };

  return { art: "warten" };
}

/** „von 14:00 bis 16:30" — für Mitteilung und KI-Kontext. */
export function fensterLabel(block: FreiBlock): string {
  const zeit = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
  return `${zeit.format(block.von)}–${zeit.format(block.bis)}`;
}
