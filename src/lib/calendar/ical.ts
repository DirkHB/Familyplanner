import ICAL from "ical.js";
import type { ParsedEvent, Occurrence } from "./types";

/**
 * iCalendar-Parsing und Wiederholungs-Expansion. Kein Eigenbau — ical.js macht die
 * Schwerarbeit (RRULE, EXDATE, RECURRENCE-ID). Dieses Modul kapselt es hinter zwei
 * klaren Funktionen und normalisiert alles auf UTC.
 */

function ymd(t: ICAL.Time): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.year}-${p(t.month)}-${p(t.day)}`;
}

function vevents(raw: string): ICAL.Component[] {
  const comp = new ICAL.Component(ICAL.parse(raw));
  return comp.getAllSubcomponents("vevent");
}

/** Master-VEVENT (ohne RECURRENCE-ID) und die Ausnahmen (mit RECURRENCE-ID) trennen. */
function split(comps: ICAL.Component[]): {
  master: ICAL.Component | null;
  exceptions: ICAL.Component[];
} {
  let master: ICAL.Component | null = null;
  const exceptions: ICAL.Component[] = [];
  for (const c of comps) {
    if (c.hasProperty("recurrence-id")) exceptions.push(c);
    else if (!master) master = c;
  }
  return { master, exceptions };
}

function toParsed(comp: ICAL.Component): ParsedEvent {
  const ev = new ICAL.Event(comp);
  const start = ev.startDate;
  const end = ev.endDate;
  const allDay = start.isDate;
  const recProp = comp.getFirstPropertyValue("recurrence-id") as ICAL.Time | null;
  const rrule = comp.getFirstProperty("rrule");
  return {
    uid: ev.uid,
    summary: ev.summary ?? "",
    location: ev.location ?? null,
    description: ev.description ?? null,
    start: start.toJSDate(),
    end: end.toJSDate(),
    allDay,
    startDate: allDay ? ymd(start) : null,
    rrule: rrule ? rrule.toICALString().replace(/^RRULE:/, "") : null,
    recurrenceId: recProp ? recProp.toString() : null,
    isOverride: !!recProp,
  };
}

/** Alle VEVENTs eines Kalenders normalisiert (Master + Ausnahmen), ohne Expansion. */
export function parseEvents(raw: string): ParsedEvent[] {
  return vevents(raw).map(toParsed);
}

/**
 * Vorkommen im Zeitfenster [from, to) — mit Wiederholungen, EXDATE-Ausschlüssen und
 * RECURRENCE-ID-Ausnahmen korrekt aufgelöst.
 */
export function expandOccurrences(
  raw: string,
  from: Date,
  to: Date,
  maxIterations = 2000,
): Occurrence[] {
  const { master, exceptions } = split(vevents(raw));
  if (!master) return [];

  const event = new ICAL.Event(master);
  const exceptionKeys = new Set<string>();
  for (const ex of exceptions) {
    event.relateException(new ICAL.Event(ex));
    const recId = ex.getFirstPropertyValue("recurrence-id") as ICAL.Time | null;
    if (recId) exceptionKeys.add(recId.toString());
  }

  const base = (comp: ICAL.Component): Omit<Occurrence, "start" | "end" | "recurrenceId" | "isException"> => {
    const p = toParsed(comp);
    return {
      uid: p.uid,
      summary: p.summary,
      location: p.location,
      allDay: p.allDay,
      startDate: p.startDate,
    };
  };

  // Nicht wiederkehrend: genau ein Vorkommen (falls im Fenster).
  if (!event.isRecurring()) {
    const start = event.startDate.toJSDate();
    const end = event.endDate.toJSDate();
    if (end <= from || start >= to) return [];
    return [
      {
        ...base(master),
        start,
        end,
        recurrenceId: event.startDate.toString(),
        isException: false,
      },
    ];
  }

  const out: Occurrence[] = [];
  const it = event.iterator();
  let next: ICAL.Time | null;
  let i = 0;
  while ((next = it.next()) && i < maxIterations) {
    i++;
    if (next.toJSDate() >= to) break;
    const det = event.getOccurrenceDetails(next);
    if (det.endDate.toJSDate() <= from) continue;
    const recKey = next.toString();
    const allDay = det.startDate.isDate;
    out.push({
      ...base(det.item.component),
      start: det.startDate.toJSDate(),
      end: det.endDate.toJSDate(),
      allDay,
      startDate: allDay ? ymd(det.startDate) : null,
      recurrenceId: recKey,
      isException: exceptionKeys.has(recKey),
    });
  }
  return out;
}
