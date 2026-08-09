import type { Platz as Person } from "@/lib/haushalt/platz";

/**
 * Betreuung als echter Kalendereintrag.
 *
 * Eine Betreuungszusage hat Anfang, Ende und eine Person — und sie bindet
 * diese Person. Das ist die Definition eines Termins. Steht sie im geteilten
 * iCloud-Kalender, sieht man sie auf dem Sperrbildschirm und auf der Uhr, ohne
 * die App zu öffnen, und der andere sieht sie im selben Moment.
 *
 * Reine Zeichenkettenlogik ohne Datenbank und ohne Netz — damit die beiden
 * heiklen Punkte prüfbar bleiben: dass wir unsere eigenen Blöcke
 * wiedererkennen, und dass ein Block eindeutig zu genau einem Vorkommen
 * gehört.
 */

/** Kennzeichen im .ics. Apple Kalender ignoriert unbekannte X-Eigenschaften. */
export const CARE_MARKER = "X-PLANYOURWEEK-BETREUUNG";

/** Erkennbar schon an der UID — ohne das .ics lesen zu müssen. */
export const CARE_UID_PREFIX = "fp-care-";

/**
 * Wer beim Kind ist: einer der beiden Plätze im Haushalt — oder jemand von
 * außen (Oma, Opa, Babysitter), wenn beide nicht können.
 */
export type CarePerson = Person | "extern";

/**
 * Nur noch Rückfall: Die echten Namen stehen im Haushaltsprofil. Die
 * Platz-Werte heißen historisch „dirk" und „constanze" — sie bedeuten
 * Platz A und Platz B, sonst nichts.
 */
const NAME: Record<CarePerson, string> = {
  constanze: "Person B",
  dirk: "Person A",
  extern: "Babysitter",
};

/**
 * Titel im echten Kalender. Das Baby-Zeichen macht die Zeile auf einen Blick
 * unterscheidbar von allem anderen im gemeinsamen Kalender. Bei externer
 * Betreuung darf ein Name dabei sein — „👶 Nicolas · Oma" sagt mehr als
 * „Babysitter", und meistens ist es Oma oder Opa.
 *
 * Die Namen kommen von außen: Wer hier wohnt und wie das Kind heißt, steht
 * im Haushaltsprofil, nicht im Code.
 */
export function careBlockTitle(
  kind: string,
  wer: string,
): string {
  return `👶 ${kind} · ${wer}`;
}

/** Anzeigename für einen Platz — Rückfall, wenn kein Profil zur Hand ist. */
export function nameFuerPlatz(person: CarePerson): string {
  return NAME[person];
}

/**
 * Eindeutige, wiederherstellbare UID je Vorkommen. Weil sie sich aus Anlass
 * und Tag ergibt, finden wir denselben Block später wieder — zum Aktualisieren
 * oder Löschen — ohne eine zusätzliche Zuordnungstabelle.
 */
export function careBlockUid(eventUid: string, dayKey: string): string {
  // Fremde UIDs können alles enthalten; auf Unbedenkliches reduzieren.
  const sauber = eventUid.replace(/[^A-Za-z0-9._-]/g, "");
  return `${CARE_UID_PREFIX}${dayKey}-${sauber}@planyourweek.app`;
}

/** Ist das einer unserer Blöcke? */
export function isCareBlockUid(uid: string): boolean {
  return uid.startsWith(CARE_UID_PREFIX);
}

/**
 * Den Tag aus einer Block-UID zurücklesen.
 *
 * Der Anlass selbst lässt sich nicht zurückrechnen — beim Bauen fallen
 * Sonderzeichen weg. Der Tag genügt aber: Mit ihm findet man die wenigen
 * Betreuungen dieses Tages und vergleicht deren gebaute UID mit dieser hier.
 */
export function dayKeyFromCareBlockUid(uid: string): string | null {
  if (!isCareBlockUid(uid)) return null;
  const rest = uid.slice(CARE_UID_PREFIX.length);
  const m = /^(\d{4}-\d{2}-\d{2})-/.exec(rest);
  return m ? m[1] : null;
}

/** Beschreibung: stellt den Zusammenhang zum Anlass her. */
export function careBlockDescription(anlass: string): string {
  return `Betreuung während: ${anlass}\nAngelegt vom Familienplaner.`;
}

/* --------------------------- Zusammenfassen --------------------------- */

export type Betreuungsfenster = {
  eventUid: string;
  anlass: string;
  start: Date;
  end: Date;
};

export type Blockgruppe = {
  start: Date;
  end: Date;
  /** Alle Anlässe, die in dieses Fenster fallen — in zeitlicher Reihenfolge. */
  anlaesse: string[];
  eventUids: string[];
};

/**
 * Überlappende Betreuungszeiten derselben Person zu einer zusammenfassen.
 *
 * Der Fehler, den das behebt: Zwei Termine um 11:35 ergaben zwei
 * Betreuungsblöcke — „👶 Nicolas · Constanze" stand zweimal untereinander im
 * Kalender. Sachlich ist das eine einzige Zusage: Constanze ist von 11:35 bis
 * 12:35 bei Nicolas, egal aus wie vielen Gründen.
 *
 * Aneinandergrenzendes wird mitgenommen (10–11 und 11–12 werden 10–12) — wer
 * durchgehend gebunden ist, will einen Balken sehen, keine Kette. Eine echte
 * Lücke dazwischen bleibt eine Lücke: Vormittags und abends sind zwei
 * Zusagen, und dazwischen ist man frei.
 */
export function fasseZusammen(fenster: Betreuungsfenster[]): Blockgruppe[] {
  const sortiert = [...fenster].sort((a, b) => a.start.getTime() - b.start.getTime());
  const gruppen: Blockgruppe[] = [];

  for (const f of sortiert) {
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && f.start.getTime() <= letzte.end.getTime()) {
      if (f.end > letzte.end) letzte.end = f.end;
      letzte.anlaesse.push(f.anlass);
      letzte.eventUids.push(f.eventUid);
      continue;
    }
    gruppen.push({
      start: f.start,
      end: f.end,
      anlaesse: [f.anlass],
      eventUids: [f.eventUid],
    });
  }
  return gruppen;
}

/**
 * UID einer zusammengefassten Gruppe.
 *
 * Sie hängt nicht mehr am einzelnen Termin, sondern am Tag, an der Person und
 * an der Position im Tag. Das geht, weil ein Tag immer als Ganzes neu
 * gerechnet wird: Was nicht mehr gebraucht wird, fliegt dabei raus.
 */
export function careBlockGruppenUid(dayKey: string, wer: string, index: number): string {
  const sauber = wer.replace(/[^A-Za-z0-9._-]/g, "") || "x";
  return `${CARE_UID_PREFIX}${dayKey}-${sauber}-${index}@planyourweek.app`;
}

/** Beschreibung einer Gruppe: alle Anlässe, damit klar ist, woher sie kommt. */
export function careBlockGruppenDescription(anlaesse: string[]): string {
  const liste = anlaesse.map((a) => `\u2022 ${a}`).join("\n");
  return `Betreuung während:\n${liste}\nAngelegt vom Familienplaner.`;
}
