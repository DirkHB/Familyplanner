/**
 * Eure Läden.
 *
 * Früher fünf feste Namen im Code. Jetzt Zeilen in der Datenbank, damit ihr
 * sie in den Einstellungen selbst anlegen könnt. Hier steht nur, was ohne
 * Datenbank gilt — damit es prüfbar bleibt.
 */

export { normalizeName, nameVergeben, MAX_NAME_LAENGE } from "@/lib/names";

/** Der Schlüssel für „kein Laden". Kein Datensatz, sondern die Abwesenheit. */
export const OHNE_LADEN = "ohne";

/** Wie das Fach ohne Laden heißt. Es ist immer da und nie löschbar. */
export const OHNE_LADEN_LABEL = "Sonstiges";

export type StoreVM = { id: string; name: string };

/**
 * Die Gruppen-Kennung eines Artikels: die Laden-Id oder das Fach ohne Laden.
 * An einer Stelle, damit Anzeige und Verschieben nie auseinanderlaufen.
 */
export function groupKeyFor(storeId: string | null | undefined): string {
  return storeId ?? OHNE_LADEN;
}

/** Umgekehrt: Was aus der Oberfläche kommt, zurück in eine Laden-Id. */
export function storeIdFromGroupKey(key: string): string | null {
  return key === OHNE_LADEN ? null : key;
}
