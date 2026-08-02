import type { Person } from "@/lib/auth/allowlist";

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
 * Wer beim Baby ist: Constanze, Dirk — oder jemand von außen (Oma, Opa,
 * Babysitter), wenn beide nicht können.
 */
export type CarePerson = Person | "extern";

const NAME: Record<CarePerson, string> = {
  constanze: "Constanze",
  dirk: "Dirk",
  extern: "Babysitter",
};

/**
 * Titel im echten Kalender. Das Baby-Zeichen macht die Zeile auf einen Blick
 * unterscheidbar von allem anderen im gemeinsamen Kalender.
 */
export function careBlockTitle(person: CarePerson): string {
  return `👶 Nicolas · ${NAME[person]}`;
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
