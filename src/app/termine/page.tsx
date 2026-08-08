import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { FabErfassen } from "@/components/app/FabErfassen";
import { buildWeek } from "@/lib/calendar/view-model";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, dayKey } from "@/lib/calendar/format";
import { buildMonthMatrix, shiftMonth, isMonthKey } from "@/lib/calendar/month";
import { shortLabel } from "@/lib/calendar/keyword";
import { MonatsStrom, type StromMonat, type TagInfo } from "@/components/termine/MonatsRaster";

export const dynamic = "force-dynamic";

/**
 * Termine: der Monatsstrom. Beginnt beim aktuellen Monat und läuft ein Jahr
 * nach vorn — durchgehend scrollbar wie im Apple Kalender, ohne Blättern.
 * Ein Tipp auf einen Tag öffnet das Tages-Blatt (Termine + Neuer Termin).
 * In die Vergangenheit führt der leise Link über dem ersten Monat (?m=…).
 */

const MONATE_IM_STROM = 12;

const monatFmt = new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "UTC" });

export default async function TerminePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const now = new Date();
  const todayKey = dayKey(now);
  const startKey = isMonthKey(m) ? m : todayKey.slice(0, 7);

  // Fenster in Berliner Zeit (DST-sicher über Mittags-Anker).
  const from = startOfDayBerlin(new Date(`${startKey}-01T12:00:00Z`));
  const to = startOfDayBerlin(new Date(`${shiftMonth(startKey, MONATE_IM_STROM)}-01T12:00:00Z`));

  const { occurrences, metaByUid, careByOcc } = await getRangeData(from, to);
  const days = buildWeek(occurrences, metaByUid, now, careByOcc, undefined, { von: from, bis: to });

  // Fürs Raster reichen Kurzformen und Farben — die vollen Termine holt das
  // Tages-Blatt frisch. Das hält ein ganzes Jahr Kalender leicht.
  const eventsByDay: Record<string, TagInfo> = {};
  for (const d of days) {
    eventsByDay[d.key] = {
      chips: d.events.slice(0, 3).map((ev) => ({ t: shortLabel(ev.title), c: ev.dotColor })),
      n: d.events.length,
    };
  }

  const monate: StromMonat[] = Array.from({ length: MONATE_IM_STROM }, (_, i) => {
    const key = shiftMonth(startKey, i);
    return {
      key,
      monat: monatFmt.format(new Date(`${key}-01T00:00:00Z`)),
      jahr: key.slice(0, 4),
      weeks: buildMonthMatrix(key),
    };
  });

  const vorher = shiftMonth(startKey, -1);

  return (
    <AppShell floating={<FabErfassen />}>
      <>
        {/* Zurück in die Vergangenheit — selten gebraucht, deshalb leise. */}
        <Link
          href={`/termine?m=${vorher}`}
          className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-ink-muted"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {monatFmt.format(new Date(`${vorher}-01T00:00:00Z`))}
        </Link>

        <MonatsStrom monate={monate} eventsByDay={eventsByDay} todayKey={todayKey} />
      </>
    </AppShell>
  );
}
