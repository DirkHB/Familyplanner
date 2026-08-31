/**
 * Mehrtägige Ganztagseinträge — und was aus ihnen folgt.
 *
 * Ein Balken über mehrere Tage ist im Kalender immer derselbe Balken. Ob er
 * „wir sind weg", „jemand ist da" oder „das gilt gerade" heißt, steht nur im
 * Titel — und genau daran hängt, ob ein Vorschlag hilfreich oder albern ist.
 * „Kellerregal aufbauen" ist eine gute Idee am Samstag und eine sinnlose,
 * wenn ihr am Samstag auf Mallorca seid.
 *
 * Eingeordnet wird von der KI (`lib/ai/mehrtaegig-einordnen.ts`), gemerkt in
 * `titel_regeln`. Zwei Arten stehen dort nebeneinander:
 *
 *   art "einordnung"  — was die KI vermutet (createdBy leer)
 *   art "abwesenheit" — was ein Mensch geantwortet hat
 *
 * Der Mensch schlägt die Maschine, immer. Gefragt wird nur, wenn die Maschine
 * unsicher ist: Eine Frage, deren Antwort schon feststeht, ist keine Klärung,
 * sondern Lärm.
 *
 * Reine Logik, keine Datenbank — damit alles davon prüfbar bleibt.
 */

export const EINORDNUNGEN = ["wegfahrt", "besuch", "zustand", "unklar"] as const;
export type Einordnung = (typeof EINORDNUNGEN)[number];

/** Die Vermutung der Maschine. */
export const EINORDNUNG_ART = "einordnung";
/** Die Antwort des Menschen: „ja" (wir sind weg) oder „nein". */
export const ABWESENHEIT_ART = "abwesenheit";

/**
 * Ab wann ein Eintrag überhaupt gemeint sein kann.
 *
 * Ein einzelner Ganztagstag ist ein Geburtstag, ein Feiertag, ein Merkzettel.
 * Weg ist man ab zwei Tagen — vorher lohnt weder die Frage noch der Aufruf.
 */
export const MIN_TAGE = 2;

/** Kommt dieser Eintrag für die Einordnung in Frage? */
export function kommtInFrage(allDay: boolean, tage: number): boolean {
  return allDay && tage >= MIN_TAGE;
}

/**
 * Seid ihr in dieser Zeit weg?
 *
 * Die Antwort des Menschen gilt. Gibt es keine, gilt die Vermutung — aber nur,
 * wenn sie eine ist: „unklar" heißt nicht „nein", es heißt „ich weiß es nicht"
 * und führt zur Frage.
 */
export function istWeg(mensch: string | undefined, maschine: string | undefined): boolean {
  if (mensch === "ja") return true;
  if (mensch === "nein") return false;
  return maschine === "wegfahrt";
}

/** Ist jemand zu Besuch? Dafür gibt es keine Frage — nur die Maschine sagt es. */
export function istBesuch(mensch: string | undefined, maschine: string | undefined): boolean {
  if (mensch) return false;
  return maschine === "besuch";
}

/**
 * Muss gefragt werden?
 *
 * Nur wenn ein Mensch noch nichts gesagt hat UND die Maschine unsicher war.
 * Ohne Einordnung (keine KI, Aufruf gescheitert) wird nicht gefragt: Lieber
 * keine Frage als eine zu jedem Balken im Kalender.
 */
export function brauchtFrage(mensch: string | undefined, maschine: string | undefined): boolean {
  return !mensch && maschine === "unklar";
}

/** Die Frage auf der Karte. */
export function abwesenheitsFrage(titel: string): string {
  return `„${titel}" — seid ihr da weg von zu Hause?`;
}
