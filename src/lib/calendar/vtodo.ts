import ICAL from "ical.js";

/**
 * Erinnerungen aus iCloud lesen.
 *
 * Apple Erinnerungen sind in CalDAV nichts Eigenes: Eine Erinnerungsliste ist
 * eine Sammlung wie ein Kalender, und jede Erinnerung ein VTODO statt eines
 * VEVENT. Deshalb reicht es, dieselbe Verbindung anders zu lesen.
 *
 * Nur Lesen — wir übernehmen die Aufgaben einmal (Variante B) und schreiben
 * nie zurück. Alles, was VTODO sonst noch kann (Unteraufgaben, Wiederholungen,
 * Ortsauslöser), lassen wir bewusst liegen, statt es halb zu übersetzen.
 */

export type ParsedTodo = {
  uid: string;
  summary: string;
  notes: string | null;
  /** Fälligkeit als reines Datum (YYYY-MM-DD), wenn eine gesetzt ist. */
  dueDate: Date | null;
  done: boolean;
};

/**
 * Ist diese Erinnerung erledigt?
 *
 * Apple setzt STATUS:COMPLETED, andere Programme nur COMPLETED oder
 * PERCENT-COMPLETE:100. Wer nur auf STATUS schaut, holt sich abgehakte
 * Erinnerungen als offene Aufgaben zurück — und das fällt erst auf, wenn der
 * Import längst gelaufen ist.
 */
function istErledigt(comp: ICAL.Component): boolean {
  const status = comp.getFirstPropertyValue("status");
  if (typeof status === "string" && status.toUpperCase() === "COMPLETED") return true;
  if (comp.getFirstProperty("completed")) return true;
  const pct = comp.getFirstPropertyValue("percent-complete");
  return Number(pct) >= 100;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  try {
    return (value as ICAL.Time).toJSDate();
  } catch {
    return null;
  }
}

/** Alle Erinnerungen eines .ics. In der Regel genau eine. */
export function parseTodos(raw: string): ParsedTodo[] {
  try {
    return vtodos(raw);
  } catch {
    // Eine kaputte Erinnerung darf nicht den ganzen Import kippen. Der Schutz
    // muss das Auslesen mit umfassen, nicht nur das Zerlegen: Leerer Text
    // kommt durch ICAL.parse durch und fällt erst danach um.
    return [];
  }
}

function vtodos(raw: string): ParsedTodo[] {
  const comp = new ICAL.Component(ICAL.parse(raw));
  return comp.getAllSubcomponents("vtodo").map((c) => {
    const summary = c.getFirstPropertyValue("summary");
    const notes = c.getFirstPropertyValue("description");
    return {
      uid: String(c.getFirstPropertyValue("uid") ?? ""),
      summary: typeof summary === "string" ? summary.trim() : "",
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      dueDate: toDate(c.getFirstPropertyValue("due")),
      done: istErledigt(c),
    };
  });
}

/** Enthält dieses .ics überhaupt Erinnerungen? Erkennt Erinnerungslisten. */
export function hasTodos(raw: string): boolean {
  return parseTodos(raw).length > 0;
}
