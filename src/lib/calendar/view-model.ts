import type { Occurrence } from "./types";
import { formatTime, groupByDay, formatDateHeader, dayKey } from "./format";
import { categoryOf, guessCategory } from "./categories";
import { isCareBlockUid } from "@/lib/care/block";
import { buildStrahl, STANDARD_FENSTER, type StrahlSegment, type TagesFenster } from "./zeitstrahl";

/** Serialisierbare View-Models für die Client-Komponenten (Server formatiert, Client rendert). */

export type { Platz as Person } from "@/lib/haushalt/platz";
import type { Platz as Person } from "@/lib/haushalt/platz";

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
  /** Zeitstrahl des Tages: freie Blöcke und Termingruppen, ganztägiges außen vor. */
  strahl: StrahlSegment[];
};

export type EventMeta = {
  category?: string | null;
  notes?: string | null;
  care?: { status: "geklaert" | "offen" | "da"; responsible?: Person[] } | null;
  people?: Person[];
  openCount?: number;
};

/** Betreuungsstatus je Vorkommen, Schlüssel `${uid}:${YYYY-MM-DD}` (Berlin). */
export type CareByOcc = Map<
  string,
  { status: string; person: Person | null; externName?: string | null }
>;

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
  fenster: TagesFenster = STANDARD_FENSTER,
  /** Der abgefragte Zeitraum — hält mehrtägiges Ganztägiges im Fenster. */
  zeitraum?: { von: Date; bis: Date },
): DayVM[] {
  const groups = groupByDay(occurrences, now, zeitraum);
  return groups.map((g) => ({
    key: g.key,
    weekday: g.weekday,
    dayNumber: g.dayNumber,
    isToday: g.isToday,
    strahl: buildStrahl(
      g.occurrences
        .filter((o) => !o.allDay)
        .map((o) => ({ key: `${o.uid}:${o.recurrenceId}`, start: o.start, end: o.end })),
      g.key,
      fenster,
    ),
    events: g.occurrences.map((o): EventVM => {
      const meta = metaByUid.get(o.uid) ?? {};
      const cat = meta.category ? categoryOf(meta.category) : categoryOf(guessCategory(o.summary));

      /*
       * Das Etikett nennt den Zustand, nicht die Person. Den Namen trägt der
       * Avatar daneben, und der holt ihn aus dem Haushalt — hier standen bis
       * eben unsere beiden Namen fest im Code, für einen zweiten Haushalt
       * also schlicht die falschen.
       */
      let care: EventVM["care"] = null;
      if (meta.care) {
        care = {
          status: meta.care.status,
          label: CARE_LABEL[meta.care.status],
          person: meta.care.responsible?.[0] ?? null,
        };
      } else if (!o.allDay && careByOcc) {
        const c = careByOcc.get(`${o.uid}:${dayKey(o.start)}`);
        if (c && c.status !== "keine") {
          if (c.status === "offen") care = { status: "offen", label: "Betreuung offen", person: null };
          else if (c.status === "extern")
            care = { status: "da", label: `${c.externName ?? "Babysitter"} ist da`, person: null };
          else if (c.person) care = { status: "da", label: CARE_LABEL.da, person: c.person };
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
  status: "offen" | "zugesagt" | "geklaert" | "keine" | "extern";
  responsibleName: string | null;
  responsiblePerson: Person | null;
  /** Bei „extern": wer von außen kommt (Oma, Opa, Babysitter). */
  externName?: string | null;
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
  /** In wessen Kalender der Termin liegt — „In Yvonnes Kalender". */
  kalenderPlatz: Person | null;
  /** Offene Betreuungsfrage zu diesem Vorkommen, fertig beschriftet. */
  anfrage: { vonMir: boolean; seitLabel: string } | null;
  /**
   * Ein von der App selbst angelegter Betreuungsblock („👶 Nicolas · Dirk").
   * Der ist die Antwort auf eine Betreuungsfrage, nicht selbst ein Termin —
   * er braucht weder Betreuung noch Vorbereitung noch Einkauf.
   */
  isCareBlock: boolean;
  /**
   * Wozu der Block gehört. `null` heißt: Den Anlass gibt es nicht mehr — dann
   * ist der Block verwaist und kann nur noch weggeräumt werden.
   */
  careBlockAnlass: string | null;
  /**
   * Bin ICH der, der die Betreuung übernommen hat?
   *
   * „Ich kann doch nicht" darf nur dastehen, wenn ich es auch zurücknehmen
   * kann. Auf dem Block des anderen wäre der Knopf ein Angebot, seine Zusage
   * für ihn zurückzuziehen — und genau so sah es aus.
   */
  careBlockIch: boolean;
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
  kalenderPlatz?: Person | null;
  anfrage?: { vonMir: boolean; seit: Date } | null;
  careBlockAnlass?: string | null;
  careBlockIch?: boolean;
};

/** „seit 20 Min." — grob reicht, es geht um „wartet schon länger". */
function seitWann(seit: Date, now: Date = new Date()): string {
  const min = Math.max(0, Math.floor((now.getTime() - seit.getTime()) / 60_000));
  if (min < 1) return "gerade eben";
  if (min < 60) return `seit ${min} Min.`;
  const std = Math.floor(min / 60);
  if (std < 24) return std === 1 ? "seit 1 Std." : `seit ${std} Std.`;
  const tage = Math.floor(std / 24);
  return tage === 1 ? "seit gestern" : `seit ${tage} Tagen`;
}

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
    kalenderPlatz: v.kalenderPlatz ?? null,
    anfrage: v.anfrage
      ? { vonMir: v.anfrage.vonMir, seitLabel: seitWann(v.anfrage.seit) }
      : null,
    isCareBlock: istBlock,
    careBlockAnlass: v.careBlockAnlass ?? null,
    careBlockIch: v.careBlockIch ?? false,
    readOnly,
  };
}
