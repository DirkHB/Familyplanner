/**
 * Regeln für selbst vergebene Namen — Aufgabenlisten und Läden.
 *
 * Beides sind Fächer, die ihr selbst anlegt, und beide haben dieselben zwei
 * Probleme: versehentlicher Leerraum und derselbe Name zweimal. Deshalb an
 * einer Stelle, sonst laufen die Regeln mit der Zeit auseinander.
 */

/** Eine Überschrift, die über zwei Zeilen läuft, hilft niemandem. */
export const MAX_NAME_LAENGE = 24;

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LAENGE);
}

/**
 * Ist der Name schon vergeben? Ohne Rücksicht auf Groß- und Kleinschreibung —
 * „Lidl" und „lidl" nebeneinander wäre für niemanden ein Gewinn.
 */
export function nameVergeben(name: string, vorhandene: readonly string[]): boolean {
  const k = normalizeName(name).toLowerCase();
  return vorhandene.some((v) => normalizeName(v).toLowerCase() === k);
}
