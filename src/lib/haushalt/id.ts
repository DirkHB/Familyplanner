/**
 * Wem gehören diese Daten?
 *
 * Heute läuft je Haushalt eine eigene Datenbank — die Antwort ist also
 * immer dieselbe. Trotzdem steht die Frage schon überall dort, wo sie
 * später beantwortet werden müsste: in Cache-Schlüsseln, in den beiden
 * Eindeutigkeiten, die sonst über Haushalte hinweg kollidieren würden, und
 * an den drei Stellen, die „die eine Einkaufsliste" oder „den einen
 * Kalenderzugang" suchen.
 *
 * Der Grund ist nicht Vorratshaltung, sondern die Art der Fehler, die sonst
 * entstehen: Ein geteilter Cache-Eintrag oder eine kollidierende
 * Eindeutigkeit wirft keine Ausnahme — sie liefern stillschweigend fremde
 * Daten. Solche Fehler findet man nicht durch Tests, sondern durch Zufall.
 *
 * Wenn daraus einmal mehrere Haushalte in einer Datenbank werden, ist das
 * hier die einzige Stelle, die sich ändert: Sie liest den Haushalt dann aus
 * dem Anfragekontext statt eine Konstante zurückzugeben. Der Zugriff bleibt
 * synchron, damit die Signatur überall gleich bleibt.
 *
 * Reine Logik ohne Server-Bindung — auch Cache-Schlüssel dürfen sie nutzen.
 */

/** Solange eine Datenbank genau einem Haushalt gehört. */
export const EIN_HAUSHALT = "1";

export function haushaltId(): string {
  return EIN_HAUSHALT;
}
