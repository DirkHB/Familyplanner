/**
 * „Thomas' Kalender", nicht „Thomass Kalender".
 *
 * Solange nur unsere beiden Namen im Code standen, kam die Frage nie auf —
 * „Dirks" und „Constanzes" gehen glatt durch. Sobald die Namen aus der
 * Datenbank kommen, steht irgendwann ein Thomas, ein Lukas oder eine Alex da,
 * und dann liest sich die Oberfläche falsch.
 *
 * Regel: Namen auf s-Laut (s, ß, x, z) bekommen nur einen Apostroph,
 * alle anderen ein angehängtes s.
 */
export function besitzform(name: string): string {
  const n = name.trim();
  if (!n) return "";
  return /[sßxz]$/i.test(n) ? `${n}’` : `${n}s`;
}
