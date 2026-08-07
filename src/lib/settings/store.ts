import "server-only";
import { getHaushaltFlag, setHaushaltFlag } from "@/lib/haushalt/singletons";

/**
 * Schalter des Haushalts.
 *
 * Sie liegen in `AppSetting`, aber der Schlüssel trägt den Haushalt — sonst
 * legte ein Haushalt den Schalter für alle um. Die Ablage selbst steckt in
 * `haushalt/singletons`, damit es genau eine Stelle gibt, die das weiß.
 */

/**
 * Schreibt die App Betreuungsblöcke in den echten iCloud-Kalender?
 *
 * Standard ist AUS. Das ist die erste Funktion, die selbstständig Einträge im
 * gemeinsamen Kalender anlegt — das schaltet man bewusst ein, nachdem man das
 * Ergebnis einmal gesehen hat, und nicht durch ein Update.
 */
export const CARE_BLOCKS = "care.blocks";

export async function getFlag(key: string, fallback = false): Promise<boolean> {
  return getHaushaltFlag(key, fallback);
}

export async function setFlag(key: string, value: boolean): Promise<void> {
  return setHaushaltFlag(key, value);
}
