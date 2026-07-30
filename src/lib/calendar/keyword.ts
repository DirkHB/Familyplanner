/**
 * Kurz-Stichwort für die Monatskacheln: aus einem Termintitel das prägnanteste
 * Wort ableiten, hart gekürzt — deterministisch statt KI, damit die Monatsansicht
 * ohne Wartezeit/Kosten rendert.
 */

const STOP = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einem", "einen", "einer",
  "und", "mit", "bei", "beim", "im", "in", "am", "an", "um", "auf", "für", "fuer",
  "zu", "zum", "zur", "nach", "von", "vom", "termin", "neuer", "neue",
]);

export function shortLabel(title: string, max = 10): string {
  const cleaned = title
    .replace(/[\p{Extended_Pictographic}‍️]/gu, " ") // Emojis raus
    .replace(/[·|–—-]+/g, " ")
    .trim();
  if (!cleaned) return "";

  const words = cleaned.split(/\s+/);
  const meaningful = words.filter((w) => !STOP.has(w.toLowerCase()));
  const pick = meaningful[0] ?? words[0];

  // Zweites Wort mitnehmen, wenn beide zusammen noch gut passen ("U3 Kinderarzt").
  const second = meaningful[1];
  const combined = second && (pick.length + 1 + second.length) <= max ? `${pick} ${second}` : pick;

  return combined.length > max ? combined.slice(0, max - 1) + "…" : combined;
}
