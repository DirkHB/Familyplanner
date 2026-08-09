import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { expandOccurrences } from "./ical";
import { dayKey } from "./format";
import { PLATZ_A, type Platz as Person } from "@/lib/haushalt/platz";
import type { Occurrence } from "./types";
import type { EventMeta } from "./view-model";
import { careWindow } from "@/lib/care/gaps";
import { aktuellerHaushalt } from "@/lib/haushalt/aktuell";
import { mitHaushalt } from "@/lib/haushalt/kontext";

/**
 * Gebündelte, kurz gecachte Bereichsdaten für Woche/Monat: Vorkommen + Zusatzdaten
 * (Kategorie, Notizen) + Betreuungsstatus je Vorkommen. 60 s Cache, bei jeder
 * eigenen Änderung sofort per Tag invalidiert → Ansichten fühlen sich sofort an,
 * ohne je veraltet zu wirken.
 */

/**
 * Der Tag trägt den Haushalt: Sonst würde ein Haushalt beim Ändern eines
 * Termins den Zwischenspeicher aller anderen leeren — und schlimmer, alle
 * würden sich denselben Eintrag teilen.
 */
export function kalenderTag(haushalt: string): string {
  return `kalender:${haushalt}`;
}

export async function invalidateKalender() {
  revalidateTag(kalenderTag(await aktuellerHaushalt("Kalender-Zwischenspeicher")));
}

type Wire = {
  occ: (Omit<Occurrence, "start" | "end"> & { start: string; end: string })[];
  details: { eventUid: string; category: string; notes: string | null }[];
  care: {
    eventUid: string;
    day: string;
    status: string;
    email: string | null;
    slot: string | null;
    note: string | null;
  }[];
};

/**
 * Ein Lader je Haushalt. Der Haushalt steckt im Schlüssel und im Tag —
 * ohne ihn teilten sich zwei Haushalte, die dieselbe Woche laden, denselben
 * Eintrag. Das wäre kein Fehler, den man sieht, sondern einer, der fremde
 * Termine ausliefert.
 */
const lader = new Map<string, (fromISO: string, toISO: string) => Promise<Wire>>();

function ladeFuer(haushalt: string) {
  const vorhanden = lader.get(haushalt);
  if (vorhanden) return vorhanden;
  const neu = baueLader(haushalt);
  lader.set(haushalt, neu);
  return neu;
}

const baueLader = (haushalt: string) =>
  unstable_cache(
  // Der Haushalt wird hier noch einmal ausdrücklich gesetzt: Was Next.js
  // zwischenspeichert, läuft nicht zwingend im Kontext der Anfrage, die es
  // angefordert hat — beim Nachladen im Hintergrund ganz sicher nicht.
  (fromISO: string, toISO: string): Promise<Wire> => mitHaushalt(haushalt, async () => {
    const from = new Date(fromISO);
    const to = new Date(toISO);

    const events = await prisma.event.findMany({
      where: {
        calendar: { isSynced: true },
        OR: [{ rrule: { not: null } }, { AND: [{ start: { lt: to } }, { end: { gt: from } }] }],
      },
      select: { rawIcs: true },
    });

    const occ: Wire["occ"] = [];
    for (const e of events) {
      try {
        for (const o of expandOccurrences(e.rawIcs, from, to)) {
          occ.push({ ...o, start: o.start.toISOString(), end: o.end.toISOString() });
        }
      } catch {
        /* defektes .ics kippt nie die Ansicht */
      }
    }

    const uids = [...new Set(occ.map((o) => o.uid))];
    const details = uids.length
      ? await prisma.eventDetail.findMany({
          where: { eventUid: { in: uids } },
          select: { eventUid: true, category: true, notes: true },
        })
      : [];

    // Betreuungen liegen auf Mitternacht des jeweiligen Tages. Mit `from` als
    // Untergrenze fiele die Betreuung für heute ab 00:01 heraus — siehe careWindow.
    const careRange = careWindow(from, to);
    const careRows = await prisma.careAssignment.findMany({
      where: { occurrenceDate: { gte: careRange.from, lte: careRange.to } },
      include: { responsible: { select: { email: true, slot: true } } },
    });

    return {
      occ,
      details,
      care: careRows.map((c) => ({
        eventUid: c.eventUid,
        day: dayKey(c.occurrenceDate),
        status: c.status,
        email: c.responsible?.email ?? null,
        slot: c.responsible?.slot ?? null,
        note: c.status === "extern" ? c.note : null,
      })),
    };
  }),
    ["kalender-range", haushalt],
    { revalidate: 60, tags: [kalenderTag(haushalt)] },
  );

export type CareOcc = { status: string; person: Person | null; externName?: string | null };

export async function getRangeData(from: Date, to: Date) {
  const haushalt = await aktuellerHaushalt("Bereichsdaten");
  const d = await ladeFuer(haushalt)(from.toISOString(), to.toISOString());
  const occurrences: Occurrence[] = d.occ.map((o) => ({
    ...o,
    start: new Date(o.start),
    end: new Date(o.end),
  }));
  const metaByUid = new Map<string, EventMeta>(
    d.details.map((x) => [x.eventUid, { category: x.category, notes: x.notes }]),
  );
  const careByOcc = new Map<string, CareOcc>(
    d.care.map((c) => [
      `${c.eventUid}:${c.day}`,
      { status: c.status, person: (c.slot as Person | null) ?? null, externName: c.note },
    ]),
  );
  return { occurrences, metaByUid, careByOcc };
}
