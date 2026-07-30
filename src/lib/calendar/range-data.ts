import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { expandOccurrences } from "./ical";
import { dayKey } from "./format";
import { personForEmail, type Person } from "@/lib/auth/allowlist";
import type { Occurrence } from "./types";
import type { EventMeta } from "./view-model";

/**
 * Gebündelte, kurz gecachte Bereichsdaten für Woche/Monat: Vorkommen + Zusatzdaten
 * (Kategorie, Notizen) + Betreuungsstatus je Vorkommen. 60 s Cache, bei jeder
 * eigenen Änderung sofort per Tag invalidiert → Ansichten fühlen sich sofort an,
 * ohne je veraltet zu wirken.
 */

export const KALENDER_TAG = "kalender";

export function invalidateKalender() {
  revalidateTag(KALENDER_TAG);
}

type Wire = {
  occ: (Omit<Occurrence, "start" | "end"> & { start: string; end: string })[];
  details: { eventUid: string; category: string; notes: string | null }[];
  care: { eventUid: string; day: string; status: string; email: string | null }[];
};

const load = unstable_cache(
  async (fromISO: string, toISO: string): Promise<Wire> => {
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

    const careRows = await prisma.careAssignment.findMany({
      where: { occurrenceDate: { gte: from, lte: to } },
      include: { responsible: { select: { email: true } } },
    });

    return {
      occ,
      details,
      care: careRows.map((c) => ({
        eventUid: c.eventUid,
        day: dayKey(c.occurrenceDate),
        status: c.status,
        email: c.responsible?.email ?? null,
      })),
    };
  },
  ["kalender-range"],
  { revalidate: 60, tags: [KALENDER_TAG] },
);

export type CareOcc = { status: string; person: Person | null };

export async function getRangeData(from: Date, to: Date) {
  const d = await load(from.toISOString(), to.toISOString());
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
      { status: c.status, person: c.email ? personForEmail(c.email) : null },
    ]),
  );
  return { occurrences, metaByUid, careByOcc };
}
