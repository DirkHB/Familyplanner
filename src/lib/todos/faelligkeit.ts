/**
 * „Bis wann?" — die Antworten, die man fast immer gibt.
 *
 * Ein leeres Datumsfeld ist die unfreundlichste Frage der App: Es sagt nicht,
 * was hineingehört, und wer antworten will, muss durch einen Kalender
 * blättern, um „morgen" zu sagen. Drei Vorschläge decken den Alltag ab; der
 * Kalender bleibt für alles andere.
 *
 * Gerechnet wird in Europe/Berlin, nicht in der Zeitzone des Servers. Sonst
 * heißt „heute" zwischen Mitternacht und zwei Uhr morgens „gestern" — und
 * genau in dieser Stunde legt man Aufgaben an, die einem nicht aus dem Kopf
 * gehen.
 */

const BERLIN = "Europe/Berlin";

/** yyyy-mm-dd in Berlin — dasselbe Format, das ein Datumsfeld erwartet. */
export function tagesSchluessel(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: BERLIN }).format(d);
}

/**
 * Einen Tag weiterzählen — über einen Mittags-Anker.
 *
 * 24 Stunden auf Mitternacht zu addieren geht in der Nacht der Zeitumstellung
 * schief: Aus dem 27. Oktober wird dann wieder der 27. Oktober. Vom Mittag aus
 * ist der Abstand zur nächsten Tagesgrenze groß genug, dass die eine Stunde
 * nichts ausmacht.
 */
function plusTage(d: Date, tage: number): Date {
  const [j, m, t] = tagesSchluessel(d).split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t + tage, 12, 0, 0));
}

/** Der Wochentag in Berlin, 0 = Sonntag. */
function wochentag(d: Date): number {
  const kurz = new Intl.DateTimeFormat("en-US", { timeZone: BERLIN, weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(kurz);
}

export type Vorschlag = { schluessel: string; label: string };

/**
 * Die drei Vorschläge.
 *
 * „Wochenende" heißt der kommende Samstag — und am Wochenende selbst heißt es
 * heute. Wer samstags „Wochenende" antippt, meint nicht in acht Tagen.
 */
export function vorschlaege(jetzt: Date = new Date()): Vorschlag[] {
  const tag = wochentag(jetzt);
  // Sa = heute, So = heute, sonst bis zum nächsten Samstag zählen.
  const bisSamstag = tag === 6 || tag === 0 ? 0 : 6 - tag;
  return [
    { schluessel: tagesSchluessel(jetzt), label: "Heute" },
    { schluessel: tagesSchluessel(plusTage(jetzt, 1)), label: "Morgen" },
    { schluessel: tagesSchluessel(plusTage(jetzt, bisSamstag)), label: "Wochenende" },
  ];
}

/**
 * Wie ein gewählter Tag heißt.
 *
 * „Heute" und „Morgen" statt eines Datums: Ein Datum muss man ausrechnen, ein
 * Wort versteht man. Alles Weitere mit Wochentag, weil „Do, 13. Aug." mehr
 * sagt als „13.08." — man weiß sofort, ob das noch diese Woche ist.
 */
export function datumsLabel(schluessel: string, jetzt: Date = new Date()): string {
  if (!schluessel) return "";
  const [heute, morgen] = vorschlaege(jetzt);
  if (schluessel === heute.schluessel) return "Heute";
  if (schluessel === morgen.schluessel) return "Morgen";

  const [j, m, t] = schluessel.split("-").map(Number);
  if (!j || !m || !t) return schluessel;
  const d = new Date(Date.UTC(j, m - 1, t, 12, 0, 0));
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: BERLIN,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

/** Liegt der Tag in der Vergangenheit? Dann wird er in der Oberfläche markiert. */
export function istVergangen(schluessel: string, jetzt: Date = new Date()): boolean {
  if (!schluessel) return false;
  return schluessel < tagesSchluessel(jetzt);
}
