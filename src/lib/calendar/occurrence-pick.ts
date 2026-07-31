import type { Occurrence } from "./types";

/**
 * Welches Vorkommen zeigt die Detailseite — und wie heißt es?
 *
 * Bewusst ohne Datenbankzugriff, damit beides geprüft werden kann. Der Fall,
 * der uns eingeholt hat: In Apple Kalender wird ein einzelner Termin einer
 * Serie umbenannt. Das landet als Ausnahme (RECURRENCE-ID) im selben .ics,
 * während die Spalte `title` weiter den Serientitel trägt. Woche und Monat
 * lesen die Vorkommen und zeigten längst den neuen Namen — die Detailansicht
 * las die Spalte und blieb beim alten.
 */

export type EventHead = { title: string; location: string | null };

/** Das nächste noch nicht beendete Vorkommen, sonst das zuletzt bekannte. */
export function pickOccurrence(occurrences: Occurrence[], now: Date): Occurrence | null {
  return occurrences.find((o) => o.end >= now) ?? occurrences[occurrences.length - 1] ?? null;
}

/** Kopfdaten dieses Vorkommens; die Serienwerte sind nur die Rückfallebene. */
export function headForOccurrence(occurrence: Occurrence | null, fallback: EventHead): EventHead {
  if (!occurrence) return fallback;
  return {
    title: occurrence.summary || fallback.title,
    location: occurrence.location ?? fallback.location,
  };
}
