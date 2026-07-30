import Link from "next/link";
import { TabBar } from "@/components/app/TabBar";
import { buildWeek, type DayVM, type EventVM } from "@/lib/calendar/view-model";
import { getOccurrencesForRange, getMetaByUid } from "@/lib/calendar/repository";
import { startOfDayBerlin, dayKey } from "@/lib/calendar/format";
import { buildMonthMatrix, monthTitle, shiftMonth, isMonthKey } from "@/lib/calendar/month";

export const dynamic = "force-dynamic";

/**
 * Termine: schnelle Monatsansicht (Raster) + Tagesliste des Monats darunter.
 * Tag antippen springt zur Tagesgruppe (Anker — kein Server-Roundtrip).
 */
export default async function TerminePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const now = new Date();
  const todayKey = dayKey(now);
  const monthKey = isMonthKey(m) ? m : todayKey.slice(0, 7);

  // Monatsfenster in Berliner Zeit (DST-sicher über Mittags-Anker).
  const from = startOfDayBerlin(new Date(`${monthKey}-01T12:00:00Z`));
  const to = startOfDayBerlin(new Date(`${shiftMonth(monthKey, 1)}-01T12:00:00Z`));

  const occurrences = await getOccurrencesForRange(from, to);
  const uids = [...new Set(occurrences.map((o) => o.uid))];
  const meta = await getMetaByUid(uids);
  const days = buildWeek(occurrences, meta, now).filter((d) => d.key.startsWith(monthKey));
  const countByDay = new Map(days.map((d) => [d.key, d.events.length]));

  const weeks = buildMonthMatrix(monthKey);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-28 pt-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl">{monthTitle(monthKey)}</h1>
          <div className="flex gap-2">
            <MonthNav href={`/termine?m=${shiftMonth(monthKey, -1)}`} label="Voriger Monat" dir="left" />
            <MonthNav href={`/termine?m=${shiftMonth(monthKey, 1)}`} label="Nächster Monat" dir="right" />
          </div>
        </div>

        {/* Monatsraster */}
        <div className="mt-5 rounded-card bg-surface p-4 shadow-card">
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => (
              <span key={w} className="pb-1 text-xs text-ink-muted">{w}</span>
            ))}
            {weeks.flat().map((cell) => {
              const count = cell.inMonth ? (countByDay.get(cell.key) ?? 0) : 0;
              const isToday = cell.key === todayKey;
              const inner = (
                <span
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full text-sm tnum ${
                    isToday
                      ? "bg-accent font-semibold text-surface"
                      : cell.inMonth
                        ? count > 0
                          ? "font-medium text-ink"
                          : "text-ink-muted"
                        : "text-ink-muted/30"
                  }`}
                >
                  {cell.day}
                  {count > 0 && !isToday && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent" />
                  )}
                </span>
              );
              return count > 0 ? (
                <a key={cell.key} href={`#${cell.key}`} className="flex justify-center">
                  {inner}
                </a>
              ) : (
                <span key={cell.key} className="flex justify-center">{inner}</span>
              );
            })}
          </div>
        </div>

        {/* Tagesliste des Monats */}
        {days.length === 0 ? (
          <div className="mt-8 rounded-card bg-surface p-6 text-center shadow-card">
            <p className="font-display text-xl">Nichts geplant</p>
            <p className="mt-2 text-ink-muted">In diesem Monat ist bisher alles frei.</p>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-5">
            {days.map((day) => (
              <DayBlock key={day.key} day={day} />
            ))}
          </div>
        )}
      </div>
      <TabBar />
    </div>
  );
}

function MonthNav({ href, label, dir }: { href: string; label: string; dir: "left" | "right" }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={dir === "right" ? { transform: "scaleX(-1)" } : undefined}>
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

function DayBlock({ day }: { day: DayVM }) {
  return (
    <div id={day.key} className="flex scroll-mt-4 gap-4">
      <div className="w-12 shrink-0 pt-1 text-center">
        <p className={`tnum font-display text-2xl leading-none ${day.isToday ? "text-accent" : ""}`}>
          {day.dayNumber}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{day.weekday.slice(0, 2)}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {day.events.map((ev) => (
          <EventLine key={ev.key} ev={ev} />
        ))}
      </div>
    </div>
  );
}

function EventLine({ ev }: { ev: EventVM }) {
  return (
    <Link
      href={ev.href}
      className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-card active:scale-[0.99]"
      style={{ transition: "transform 120ms cubic-bezier(0.16,1,0.3,1)" }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ev.dotColor }} />
      <span className="min-w-0 flex-1 truncate font-medium">{ev.title}</span>
      <span className="tnum shrink-0 text-sm text-ink-muted">
        {ev.allDay ? "ganztägig" : ev.time}
      </span>
    </Link>
  );
}
