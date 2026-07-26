import type { Occurrence } from "./types";
import { formatTime, groupByDay, formatDateHeader } from "./format";
import { categoryOf, guessCategory } from "./categories";

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
  care: { status: "geklaert" | "offen" | "da"; label: string } | null;
  people: Person[];
  openCount: number;
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
  care?: { status: "geklaert" | "offen" | "da"; responsible?: Person[] } | null;
  people?: Person[];
  openCount?: number;
};

const CARE_LABEL = {
  geklaert: "Betreuung geklärt",
  offen: "Betreuung offen",
  da: "ist da",
} as const;

/** Baut die Tagesgruppen für die Wochenansicht. metaByUid liefert App-Zusatzdaten (an der UID). */
export function buildWeek(
  occurrences: Occurrence[],
  metaByUid: Map<string, EventMeta> = new Map(),
  now: Date = new Date(),
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
      const care = meta.care
        ? {
            status: meta.care.status,
            label:
              meta.care.status === "da" && meta.care.responsible?.length
                ? `${meta.care.responsible[0] === "constanze" ? "Constanze" : "Dirk"} ist da`
                : CARE_LABEL[meta.care.status],
          }
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
      };
    }),
  }));
}

/* ------------------------------ Termin-Detail ------------------------------ */

export type CareVM = {
  status: "offen" | "zugesagt" | "geklaert";
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
  location: string | null;
  categoryLabel: string;
  dotColor: string;
  notes: string;
  prep: { text: string; done: boolean }[];
  occurrenceISO: string | null;
  care: CareVM;
  readOnly?: boolean;
};

export type DetailInput = {
  uid: string;
  title: string;
  location: string | null;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  category: string;
  notes: string;
  prepChecklist: { text: string; done: boolean }[];
  occurrenceISO?: string | null;
  care?: CareVM;
};

export function buildDetailVM(v: DetailInput, readOnly = false): DetailVM {
  const cat = categoryOf(v.category);
  return {
    uid: v.uid,
    title: v.title,
    dateLabel: v.start ? formatDateHeader(v.start) : "",
    timeLabel: v.start ? formatTime(v.start) : "",
    endLabel: v.end ? formatTime(v.end) : "",
    allDay: v.allDay,
    location: v.location,
    categoryLabel: cat.label,
    dotColor: cat.dotColor,
    notes: v.notes,
    prep: v.prepChecklist,
    occurrenceISO: v.occurrenceISO ?? null,
    care: v.care ?? null,
    readOnly,
  };
}
