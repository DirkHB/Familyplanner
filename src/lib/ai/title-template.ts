/**
 * Einheitliche Aufgabentitel.
 *
 * Eine Liste wird nur dann durchgegangen, wenn jede Zeile sagt, was zu tun
 * ist. „Kinderwagen kaputt" ist eine Notiz — man weiß nicht, was man machen
 * soll. „Kinderwagen reparieren lassen" ist eine Handlung, die man abhaken
 * kann. Deshalb: Verb voran, kurz, ohne Füllwörter.
 *
 * Die Verb-Regel selbst setzt der Prompt durch. Hier steht nur das
 * deterministische Netz darunter: kürzen, Füllwörter weg, einheitlich groß.
 *
 * Eine Prüfung „steht da ein Verb?" hatte ich versucht und wieder verworfen:
 * Im Deutschen enden massenhaft Hauptwörter auf -en („Kinderwagen", „Garten",
 * „Boden"), und ohne Wörterbuch lässt sich das nicht sauber trennen. Ein
 * Hinweis, der bei „Neuer Kinderwagen" eine Handlung meldet, ist schlechter
 * als gar keiner.
 */

/** Höchstlänge in Wörtern. Alles Weitere gehört in die Notiz. */
export const MAX_WOERTER = 6;

/**
 * Einleitungen, die nichts über die Handlung sagen. Bewusst nur volle
 * Wendungen am Anfang — mitten im Satz darf „bitte" stehen bleiben.
 */
const FUELLER = [
  "ich muss noch",
  "ich muss",
  "ich sollte",
  "wir müssen noch",
  "wir müssen",
  "wir sollten",
  "man muss",
  "nicht vergessen",
  "denk dran",
  "denk daran",
  "dran denken",
  "bitte",
  "todo",
  "to-do",
  "aufgabe",
  "erinnerung",
];

/** Endungen, die am Titel kleben und keinen Beitrag leisten. */
const NACHKLAPP = /\s*(,?\s*(bitte|noch|mal|irgendwann|demnächst|bald))+\s*$/i;

function entferneFueller(text: string): string {
  let t = text;
  let geaendert = true;
  while (geaendert) {
    geaendert = false;
    const klein = t.toLowerCase();
    for (const f of FUELLER) {
      // Nur als ganzes Wort am Anfang, danach Doppelpunkt/Komma/Leerzeichen.
      if (klein.startsWith(f) && /^[\s:,-]/.test(t.slice(f.length) || " ")) {
        t = t.slice(f.length).replace(/^[\s:,-]+/, "");
        geaendert = true;
        break;
      }
    }
  }
  return t;
}

/**
 * Titel in die Hausform bringen. Ändert nie den Sinn — kürzt und räumt nur auf.
 */
export function normalizeTaskTitle(raw: string): string {
  let t = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";

  t = entferneFueller(t);
  t = t.replace(NACHKLAPP, "").replace(/[.!;:,\s]+$/, "").trim();
  if (!t) return "";

  const woerter = t.split(" ");
  if (woerter.length > MAX_WOERTER) {
    t = woerter.slice(0, MAX_WOERTER).join(" ").replace(/[.,;:]+$/, "");
  }

  return t.charAt(0).toUpperCase() + t.slice(1);
}
