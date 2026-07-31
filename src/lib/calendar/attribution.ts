import ICAL from "ical.js";
import type { Person } from "@/lib/auth/allowlist";

/**
 * Wer ist durch einen Termin gebunden?
 *
 * Constanze und Dirk schreiben alles in einen gemeinsamen Kalender — der
 * Kalender allein sagt also nichts darüber, wen ein Termin betrifft. Bevor wir
 * anfangen, das von Hand pflegen zu lassen, schauen wir nach, was ohnehin
 * schon in den Daten steht: iCloud legt bei geteilten Kalendern oft ORGANIZER
 * und ATTENDEE ab, und manchmal steht der Name einfach im Titel.
 *
 * Reine Auswertung, kein Datenbankzugriff.
 */

export type Participants = {
  /** Mail-Adresse dessen, der den Termin angelegt hat — falls hinterlegt. */
  organizer: string | null;
  attendees: string[];
};

function mail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().replace(/^mailto:/i, "").toLowerCase();
  return v.includes("@") ? v : null;
}

/** ORGANIZER und ATTENDEE aus dem Haupt-VEVENT lesen. */
export function participantsOf(rawIcs: string): Participants {
  try {
    const comp = new ICAL.Component(ICAL.parse(rawIcs));
    const vevents = comp.getAllSubcomponents("vevent");
    // Der Haupttermin, nicht eine einzelne Ausnahme.
    const master = vevents.find((v) => !v.getFirstProperty("recurrence-id")) ?? vevents[0];
    if (!master) return { organizer: null, attendees: [] };

    const organizer = mail(master.getFirstPropertyValue("organizer"));
    const attendees = master
      .getAllProperties("attendee")
      .map((p) => mail(p.getFirstValue()))
      .filter((v): v is string => v !== null);

    return { organizer, attendees };
  } catch {
    return { organizer: null, attendees: [] };
  }
}

/**
 * Steht ein Name im Titel? „Zahnarzt Dirk", „Constanze Yoga".
 * Bewusst streng: nur der volle Vorname als eigenes Wort, damit nicht jedes
 * zufällige Wortstück eine Zuordnung erfindet.
 */
export function nameHintFromTitle(title: string): Person | null {
  const t = title.toLowerCase();
  const hat = (name: string) => new RegExp(`(^|[^\\p{L}])${name}([^\\p{L}]|$)`, "u").test(t);
  const constanze = hat("constanze");
  const dirk = hat("dirk");
  // Stehen beide drin, betrifft es vermutlich beide — dann hilft der Titel nicht.
  if (constanze === dirk) return null;
  return constanze ? "constanze" : "dirk";
}
