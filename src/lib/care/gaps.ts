/**
 * Betreuungslücken für Nicolas.
 *
 * Die Frage im Alltag ist nicht „überschneiden sich zwei Termine?", sondern
 * „wer ist in dieser Zeit bei Nicolas?". Weil Constanze und Dirk alles in
 * einen gemeinsamen Kalender schreiben, wissen wir nicht, wen ein Termin
 * bindet — aber wir wissen, wann Nicolas wach ist. Jeder Termin in dieser
 * Zeit, für den niemand die Betreuung übernommen hat, ist eine offene Frage.
 *
 * Bewusst ohne Datenbank, damit die Regeln prüfbar bleiben.
 */

/** Nicolas' Wachzeit in Berliner Ortszeit. Nachts fragt niemand nach Betreuung. */
export const WACHZEIT = { vonStunde: 7, bisStunde: 20 } as const;

const berlinClock = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Datum und Minuten seit Mitternacht in Berliner Ortszeit. */
export function berlinParts(d: Date): { tag: string; minuten: number } {
  // "2026-07-30 14:05" — hourCycle h23 vermeidet die Falle, dass de-DE
  // "14 Uhr" liefert und Number() daraus NaN macht.
  const s = berlinClock.format(d);
  const [tag, uhr] = s.split(" ");
  const [h, m] = uhr.split(":").map(Number);
  return { tag, minuten: h * 60 + m };
}

/**
 * Fällt der Termin in Nicolas' Wachzeit? Ganztägige Einträge zählen nie —
 * „Urlaub" oder „Müllabfuhr" sind keine Betreuungsfrage.
 */
export function inWachzeit(start: Date, end: Date, allDay: boolean): boolean {
  if (allDay) return false;
  const a = berlinParts(start);
  const b = berlinParts(end);
  // Über Mitternacht hinaus: trifft die Wachzeit auf jeden Fall.
  if (b.tag !== a.tag) return true;
  const von = WACHZEIT.vonStunde * 60;
  const bis = WACHZEIT.bisStunde * 60;
  // Echte Überschneidung; ein Termin, der exakt um 20:00 beginnt, zählt nicht.
  return a.minuten < bis && b.minuten > von;
}

/**
 * Titel auf einen Vergleichsschlüssel bringen. Damit merkt sich die App eine
 * Entscheidung pro Termin*art* statt pro Vorkommen — „Müllabfuhr" einmal
 * abgewinkt, und die wöchentliche Wiederholung fragt nie wieder.
 */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // Akzente weg, damit „Café" = „Cafe"
    .replace(/[^\p{L}\p{N}]+/gu, " ") // alles Nicht-Alphanumerische zu Leerzeichen
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Zeitfenster für die Abfrage der Betreuungen.
 *
 * Eine Betreuung wird pro Tag gespeichert, mit Mitternacht als Zeitstempel.
 * Fragt man sie mit dem aktuellen Zeitpunkt als Untergrenze ab, fällt die
 * Betreuung für HEUTE heraus, sobald es nach Mitternacht ist — die App hielt
 * dann eine längst geklärte Betreuung für unbesprochen und fragte erneut.
 *
 * Deshalb je einen Tag Luft nach beiden Seiten. Zusätzliche Zeilen schaden
 * nicht: Nachgeschlagen wird später über den genauen Tagesschlüssel, alles
 * andere wird nie gefunden.
 */
export function careWindow(from: Date, to: Date): { from: Date; to: Date } {
  return {
    from: new Date(from.getTime() - 86_400_000),
    to: new Date(to.getTime() + 86_400_000),
  };
}

export type GapCandidate = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  /** true, sobald für dieses Vorkommen schon irgendetwas entschieden wurde. */
  hasCareDecision: boolean;
};

/**
 * Ist das eine offene Betreuungsfrage? `abgewinkt` sind die Titel-Schlüssel,
 * für die schon einmal „nicht nötig" gesagt wurde.
 */
export function isCareGap(ev: GapCandidate, abgewinkt: ReadonlySet<string>): boolean {
  if (ev.hasCareDecision) return false;
  if (!inWachzeit(ev.start, ev.end, ev.allDay)) return false;
  return !abgewinkt.has(titleKey(ev.title));
}
