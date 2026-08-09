import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Welcher Haushalt gerade dran ist.
 *
 * Zwei Wege führen hierher, und sie schließen sich nicht aus:
 *
 * 1. **Ausdrücklich gesetzt.** Der Worker hat keine Sitzung — er arbeitet für
 *    alle Haushalte nacheinander und sagt vor jedem, für wen. Dasselbe gilt
 *    für die Einrichtung: Wer gerade erst eingeladen wurde, hat noch keine
 *    Zuordnung, die man nachschlagen könnte.
 * 2. **Aus der Sitzung.** Der Normalfall im Web: Wer angemeldet ist, gehört zu
 *    genau einem Haushalt.
 *
 * Der ausdrückliche Weg gewinnt. Sonst könnte eine Hintergrundaufgabe, die
 * zufällig in einer Anfrage läuft, still auf den Haushalt des Anfragenden
 * umschwenken — und genau solche Fehler sieht man nicht.
 *
 * Warum AsyncLocalStorage und kein Parameter: Der Haushalt müsste sonst durch
 * jede der rund zweihundert Abfragen durchgereicht werden. Was durchgereicht
 * wird, kann vergessen werden; was hier steht, gilt für alles, was innerhalb
 * läuft.
 */

const speicher = new AsyncLocalStorage<string>();

/**
 * Alles innerhalb läuft für diesen Haushalt.
 *
 * Das `await` im Inneren ist kein Schmuck: Eine Prisma-Abfrage startet erst,
 * wenn jemand auf sie wartet. Gäbe man das Versprechen ungewartet zurück, wäre
 * der Kontext beim Start der Abfrage längst wieder zu — und der Riegel fände
 * keinen Haushalt. Genau das ist beim ersten Versuch passiert.
 */
export function mitHaushalt<T>(householdId: string, fn: () => Promise<T>): Promise<T> {
  return speicher.run(householdId, async () => await fn());
}

/** Der ausdrücklich gesetzte Haushalt — sonst `null`. */
export function gesetzterHaushalt(): string | null {
  return speicher.getStore() ?? null;
}

/**
 * Ausnahme vom Riegel: Diese Abfrage darf über alle Haushalte gehen.
 *
 * Es gibt genau drei berechtigte Fälle — der Worker, der alle Haushalte
 * aufzählt; das Einlösen einer Einladung, bei dem noch kein Haushalt
 * feststeht; und die Anmeldung, die eine Adresse global sucht. Jeder weitere
 * Fall ist mit hoher Wahrscheinlichkeit ein Fehler, deshalb muss man es
 * hinschreiben.
 */
const ueberAlle = new AsyncLocalStorage<true>();

export function ueberAlleHaushalte<T>(fn: () => Promise<T>): Promise<T> {
  // Gewartet wird innerhalb — siehe mitHaushalt.
  return ueberAlle.run(true, async () => await fn());
}

export function istUeberAlleHaushalte(): boolean {
  return ueberAlle.getStore() === true;
}
