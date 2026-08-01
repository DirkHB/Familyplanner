import "server-only";
import { prisma } from "@/lib/prisma";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, dayKey, formatTime, formatWeekday, formatMonthDay } from "@/lib/calendar/format";
import { personForEmail, type Person } from "@/lib/auth/allowlist";

/**
 * Übernommene Betreuung für Nicolas — nach Tagen gestaffelt.
 *
 * Quelle ist die Betreuung selbst (care_assignments), nicht mehr eine
 * automatisch erzeugte Aufgabe. Betreuung ist eine Zusage für ein Zeitfenster:
 * Man kann sie nicht vorziehen, nicht verschieben und nicht „früher
 * erledigen" — sie gehört deshalb nicht in eine Abhak-Liste.
 */

export type CareSlot = {
  /** eventUid + Tag, eindeutig je Vorkommen. */
  id: string;
  uid: string;
  title: string;
  /** „09:00–10:30" — null bei ganztägigen Terminen. */
  timeLabel: string | null;
  sort: number;
  person: Person | null;
};

export type CareDay = {
  key: string;
  label: string;
  past: boolean;
  slots: CareSlot[];
};

export async function getUpcomingCare(now: Date = new Date(), tage = 14): Promise<CareDay[]> {
  const from = startOfDayBerlin(now);
  const to = new Date(from.getTime() + tage * 86_400_000);

  const [{ occurrences }, rows] = await Promise.all([
    getRangeData(from, to),
    prisma.careAssignment.findMany({
      where: {
        occurrenceDate: { gte: new Date(from.getTime() - 86_400_000), lte: to },
        status: { in: ["geklaert", "zugesagt"] },
        responsibleUserId: { not: null },
      },
      include: { responsible: { select: { email: true } } },
    }),
  ]);

  const occByDay = new Map(occurrences.map((o) => [`${o.uid}:${dayKey(o.start)}`, o]));
  const todayKey = dayKey(now);
  const tage_ = new Map<string, CareDay>();

  for (const row of rows) {
    const key = dayKey(row.occurrenceDate);
    if (key < todayKey) continue; // Vergangenes gehört nicht in eine Vorschau
    const occ = occByDay.get(`${row.eventUid}:${key}`);
    if (!occ) continue; // Termin gibt es nicht mehr — dann auch keine Zeile

    const day = tage_.get(key) ?? {
      key,
      label:
        key === todayKey
          ? "Heute"
          : `${formatWeekday(occ.start).slice(0, 2)}, ${formatMonthDay(occ.start)}`,
      past: false,
      slots: [],
    };
    day.slots.push({
      id: `${row.eventUid}:${key}`,
      uid: row.eventUid,
      title: occ.summary,
      timeLabel: occ.allDay ? null : `${formatTime(occ.start)}–${formatTime(occ.end)}`,
      sort: occ.start.getTime(),
      person: row.responsible ? personForEmail(row.responsible.email) : null,
    });
    tage_.set(key, day);
  }

  return [...tage_.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((d) => ({ ...d, slots: d.slots.sort((a, b) => a.sort - b.sort) }));
}
