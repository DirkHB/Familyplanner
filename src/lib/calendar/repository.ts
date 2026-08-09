import "server-only";
import { prisma } from "@/lib/prisma";
import { expandOccurrences } from "./ical";
import { headForOccurrence, pickOccurrence } from "./occurrence-pick";
import type { Occurrence } from "./types";
import type { EventMeta } from "./view-model";
import { notnameAusEmail } from "@/lib/auth/allowlist";
import type { Platz } from "@/lib/haushalt/platz";

/** DB-Zugriff für die Kalenderansichten. Expandiert Wiederholungen aus den gespeicherten .ics. */

export async function getOccurrencesForRange(from: Date, to: Date): Promise<Occurrence[]> {
  const events = await prisma.event.findMany({
    where: {
      calendar: { isSynced: true },
      // Nur was das Fenster treffen kann: Serien (rrule) immer — ihr start liegt oft
      // weit zurück; Einzeltermine/Overrides nur, wenn sie das Fenster schneiden.
      // Hält Payload und ICS-Parsing klein (sonst wird jede Ansicht mit dem
      // Kalenderbestand langsamer).
      OR: [
        { rrule: { not: null } },
        { AND: [{ start: { lt: to } }, { end: { gt: from } }] },
      ],
    },
    select: { rawIcs: true },
  });
  const all: Occurrence[] = [];
  for (const e of events) {
    try {
      all.push(...expandOccurrences(e.rawIcs, from, to));
    } catch {
      // Ein defektes .ics darf nie die ganze Ansicht kippen (Abnahmekriterium 4).
    }
  }
  return all;
}

export async function getMetaByUid(uids: string[]): Promise<Map<string, EventMeta>> {
  const map = new Map<string, EventMeta>();
  if (uids.length === 0) return map;
  const details = await prisma.eventDetail.findMany({
    where: { eventUid: { in: uids } },
  });
  for (const d of details) {
    map.set(d.eventUid, { category: d.category });
  }
  return map;
}

export async function getEventDetail(uid: string) {
  return prisma.eventDetail.findUnique({ where: { eventUid: uid } });
}

export type EventDetailView = {
  uid: string;
  title: string;
  location: string | null;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  isSeries: boolean;
  category: string;
  notes: string;
  prepChecklist: { text: string; done: boolean }[];
  occurrenceISO: string | null;
  care: {
    status: "offen" | "zugesagt" | "geklaert" | "keine" | "extern";
    responsibleName: string | null;
    responsiblePerson: "dirk" | "constanze" | null;
    /** Bei „extern": wer von außen kommt (Oma, Opa, Babysitter). */
    externName: string | null;
  } | null;
};

/** Ansicht für die Termin-Detailseite: nächstes Vorkommen + App-Zusatzdaten (an der UID). */
export async function getEventView(
  uid: string,
  now: Date = new Date(),
): Promise<EventDetailView | null> {
  const event = await prisma.event.findFirst({
    where: { uid },
    // Dieselbe UID kann in mehreren Kalendern liegen — feste Reihenfolge, damit
    // nicht der Zufall entscheidet, welcher Eintrag gewinnt.
    orderBy: { calendarId: "asc" },
    select: { rawIcs: true, title: true, location: true, rrule: true },
  });
  if (!event) return null;

  let start: Date | null = null;
  let end: Date | null = null;
  let allDay = false;
  // Vorbelegung aus der Serie; ein einzeln geändertes Vorkommen überschreibt sie gleich.
  let { title, location } = { title: event.title, location: event.location };
  try {
    const horizon = new Date(now.getTime() + 365 * 86_400_000);
    const occ = expandOccurrences(event.rawIcs, new Date(now.getTime() - 86_400_000), horizon);
    const next = pickOccurrence(occ, now);
    if (next) {
      start = next.start;
      end = next.end;
      allDay = next.allDay;
      ({ title, location } = headForOccurrence(next, { title: event.title, location: event.location }));
    }
  } catch {
    /* defektes .ics → nur Kopfdaten zeigen */
  }

  const detail = await prisma.eventDetail.findUnique({ where: { eventUid: uid } });
  const prep = Array.isArray(detail?.prepChecklist)
    ? (detail!.prepChecklist as unknown as { text: string; done: boolean }[])
    : [];

  // Betreuung für dieses Vorkommen laden.
  let care: EventDetailView["care"] = null;
  if (start) {
    const occDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const row = await prisma.careAssignment.findUnique({
      where: { eventUid_occurrenceDate: { eventUid: uid, occurrenceDate: occDate } },
      include: { responsible: true },
    });
    if (row) {
      care = {
        status: row.status as "offen" | "zugesagt" | "geklaert" | "keine" | "extern",
        responsibleName: row.responsible
          ? row.responsible.name ?? notnameAusEmail(row.responsible.email)
          : null,
        responsiblePerson: (row.responsible?.slot as Platz | null) ?? null,
        externName: row.status === "extern" ? row.note : null,
      };
    }
  }

  return {
    uid,
    title,
    location,
    start,
    end,
    allDay,
    isSeries: !!event.rrule,
    category: detail?.category ?? "sonstiges",
    notes: detail?.notes ?? "",
    prepChecklist: prep,
    occurrenceISO: start ? start.toISOString() : null,
    care,
  };
}
