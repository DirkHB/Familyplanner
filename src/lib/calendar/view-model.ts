import type { Occurrence } from "./types";
import { formatTime, groupByDay, formatDateHeader, dayKey } from "./format";
import { categoryOf, guessCategory } from "./categories";
import { isCareBlockUid } from "@/lib/care/block";

/** Serialisierbare View-Models für die Client-Komponenten (Server formatiert, Client rendert). */

export type Person = "dirk" | "constanze";

export type EventVM = {
  key: string;
  uid: string;
  href: string;
  time: string; // "" bei ganztägig
  allDay: boolean;
  title: string;
  categoryLabel: string;
  dotColor: string;
  care: { status: "geklaert" | "offen" | "da"; label: string; person?: Person | null } | null;
  people: Person[];
  openCount: number;
  notesPreview: string | null;
  /** ISO des konkreten Vorkommens — für Direktaktionen aus der Liste. */
  occurrenceISO: string;
  /** Vorbei — wird in der Woche nur noch durchgestrichen gezeigt. */
  past: boolean;
};

export type DayVM = {
  key: string;
  weekday: string;
  dayNumber: string;
  isToday: boolean;
  events: EventVM[];
};

export type EventMeta = {
  category?: string | null;
  notes?: string | null;
  care?: { status: "geklaert" | "offen" | "da"; responsible?: Person[] } | null;
  people?: Person[];
  openCount?: number;
};

/** Betreuungsstatus je Vorkommen, Schlüssel `${uid}:${YYYY-MM-DD}` (Berlin). */
export type CareByOcc = Map<string, { status: string; person: Person | null }>;

const CARE_LABEL = {
  geklaert: "Betreuung geklärt",
  offen: "Betreuung offen",
  da: "ist da",
} as const;

/** Baut die Tagesgruppen für die Wochenansicht. metaByUid liefert App-Zusatzdaten (an der UID),
 *  careByOcc den Betreuungsstatus je Vorkommen (nur nicht-ganztägige Termine). */
export function buildWeek(
  occurrences: Occurrence[],
  metaByUid: Map<string, EventMeta> = new Map(),
  now: Date = new Date(),
  careByOcc?: CareByOcc,
): DayVM[] {
  const groups = groupByDay(occurrences, now);
  return groups.map((g) => ({
    key: g.key,
    weekday: g.weekday,
    dayNumber: g.dayNumber,
    isToday: g.isToday,
    events: g.occurrences.map((o): EventVM => {
      const meta = metaByUid.get(o.uid) ?? {};
      const cat = meta.category ? categoryOf(meta.category) : categoryOf(guessCategory(o.summary));

      let care: EventVM["care"] = null;
      if (meta.care) {
        care = {
          status: meta.care.status,
          label:
            meta.care.status === "da" && meta.care.responsible?.length
              ? `${meta.care.responsible[0] === "constanze" ? "Constanze" : "Dirk"} ist da`
              : CARE_LABEL[meta.care.status],
          person: meta.care.responsible?.[0] ?? null,
        };
      } else if (!o.allDay && careByOcc) {
        const c = careByOcc.get(`${o.uid}:${dayKey(o.start)}`);
        if (c && c.status !== "keine") {
          if (c.status === "offen") care = { status: "offen", label: "Betreuung offen", person: null };
          else if (c.person)
            care = {
              status: "da",
              label: `${c.person === "constanze" ? "Constanze" : "Dirk"} ist da`,
              person: c.person,
            };
        }
      }

      const notesPreview = meta.notes
        ? meta.notes.split("\n")[0].trim().slice(0, 70) || null
        : null;

      return {
        key: `${o.uid}:${o.recurrenceId}`,
        uid: o.uid,
        href: `/termin/${encodeURIComponent(o.uid)}`,
        time: o.allDay ? "" : formatTime(o.start),
        allDay: o.allDay,
        title: o.summary,
        categoryLabel: cat.label,
        dotColor: cat.dotColor,
        care,
        people: meta.people ?? [],
        openCount: meta.openCount ?? 0,
        notesPreview,
        occurrenceISO: o.start.toISOString(),
        past: o.end <= now,
      };
    }),
  }));
}

/* ------------------------------ Termin-Detail ------------------------------ */

export type CareVM = {
  status: "offen" | "zugesagt" | "geklaert" | "keine";
  responsibleName: string | null;
  responsiblePerson: Person | null;
} | null;

export type DetailVM = {
  uid: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  endLabel: string;
  allDay: boolean;
  isSeries: boolean;
  location: string | null;
  categoryLabel: string;
  dotColor: string;
  notes: string;
  prep: { text: string; done: boolean }[];
  occurrenceISO: string | null;
  care: CareVM;
  /**
   * Ein von der App selbst angelegter Betreuungsblock („👶 Nicolas · Dirk").
   * Der ist die Antwort auf eine Betreuungsfrage, nicht selbst ein Termin —
   * er braucht weder Betreuung noch Vorbereitung noch Einkauf.
   */
  isCareBlock: boolean;
  readOnly?: boolean;
};

export type DetailInput = {
  uid: string;
  title: string;
  location: string | null;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  isSeries?: boolean;
  category: string;
  notes: string;
  prepChecklist: { text: string; done: boolean }[];
  occurrenceISO?: string | null;
  care?: CareVM;
};

export function buildDetailVM(v: DetailInput, readOnly = false): DetailVM {
  const cat = categoryOf(v.category);
  const istBlock = isCareBlockUid(v.uid);
  return {
    uid: v.uid,
    title: v.title,
    dateLabel: v.start ? formatDateHeader(v.start) : "",
    timeLabel: v.start ? formatTime(v.start) : "",
    endLabel: v.end ? formatTime(v.end) : "",
    allDay: v.allDay,
    isSeries: v.isSeries ?? false,
    location: v.location,
    // „Sonstiges" über einem Betreuungsblock sagt nichts. Er hat keine
    // Kategorie im üblichen Sinn — er ist selbst eine.
    categoryLabel: istBlock ? "Betreuung" : cat.label,
    dotColor: cat.dotColor,
    notes: v.notes,
    prep: v.prepChecklist,
    occurrenceISO: v.occurrenceISO ?? null,
    care: v.care ?? null,
    isCareBlock: istBlock,
    readOnly,
  };
}
