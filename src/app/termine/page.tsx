import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { SegmentedNav } from "@/components/app/SegmentedNav";
import { BabyIcon } from "@/components/ui/BabyIcon";
import { buildWeek, type DayVM, type EventVM } from "@/lib/calendar/view-model";
import { getRangeData } from "@/lib/calendar/range-data";
import { MonthShell } from "@/components/termine/MonthShell";
import { startOfDayBerlin, dayKey } from "@/lib/calendar/format";
import { buildMonthMatrix, monthTitle, shiftMonth, isMonthKey } from "@/lib/calendar/month";
import { shortLabel } from "@/lib/calendar/keyword";

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

  const { occurrences, metaByUid, careByOcc } = await getRangeData(from, to);
  const days = buildWeek(occurrences, metaByUid, now, careByOcc).filter((d) => d.key.startsWith(monthKey));
  const eventsByDay = new Map(days.map((d) => [d.key, d.events]));

  const weeks = buildMonthMatrix(monthKey);

  return (
    <AppShell>
      <>
        <MonthShell
          prevHref={`/termine?m=${shiftMonth(monthKey, -1)}`}
          nextHref={`/termine?m=${shiftMonth(monthKey, 1)}`}
          todayId={monthKey === todayKey.slice(0, 7) ? todayKey : null}
        >
        <div className="mb-3">
          <SegmentedNav
            active="/termine"
            items={[
              { href: "/woche", label: "Woche" },
              { href: "/termine", label: "Monat" },
            ]}
          />
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl">{monthTitle(monthKey)}</h1>
          <div className="flex gap-2">
            <MonthNav href={`/termine?m=${shiftMonth(monthKey, -1)}`} label="Voriger Monat" dir="left" />
            <MonthNav href={`/termine?m=${shiftMonth(monthKey, 1)}`} label="Nächster Monat" dir="right" />
            <Link
              href="/erfassen"
              aria-label="Schnell erfassen"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-surface shadow-card"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Monatsraster: ganzer Monat in Kacheln, Termine als Mini-Stichworte */}
        <div className="mt-4 overflow-hidden rounded-card bg-surface shadow-card">
          <div className="grid grid-cols-7 border-b border-surface-muted/60 text-center">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => (
              <span key={w} className="py-1.5 text-[10px] font-medium text-ink-muted">{w}</span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-surface-muted/40 last:border-0">
              {week.map((cell) => {
                const events = cell.inMonth ? (eventsByDay.get(cell.key) ?? []) : [];
                const isToday = cell.key === todayKey;
                const shown = events.slice(0, 3);
                const more = events.length - shown.length;
                const content = (
                  <div
                    className={`flex min-h-[68px] flex-col gap-0.5 px-0.5 pb-1 pt-0.5 ${
                      cell.inMonth ? "" : "opacity-30"
                    } ${isToday ? "bg-accent-light/60" : ""}`}
                  >
                    <span
                      className={`tnum self-end px-0.5 text-[10px] leading-tight ${
                        isToday
                          ? "flex h-4 w-4 items-center justify-center self-end rounded-full bg-accent font-semibold text-surface"
                          : "text-ink-muted"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {shown.map((ev) => (
                      <span
                        key={ev.key}
                        className="block truncate rounded-[3px] pl-0.5 text-left text-[8px] font-medium leading-[1.35] text-ink"
                        style={{ borderLeft: `2px solid ${ev.dotColor}`, background: "var(--color-bg)" }}
                      >
                        {shortLabel(ev.title)}
                      </span>
                    ))}
                    {more > 0 && (
                      <span className="pl-1 text-left text-[8px] leading-none text-ink-muted">+{more}</span>
                    )}
                  </div>
                );
                return events.length > 0 ? (
                  <a key={cell.key} href={`#${cell.key}`} className="min-w-0 border-r border-surface-muted/40 last:border-r-0">
                    {content}
                  </a>
                ) : (
                  <div key={cell.key} className="min-w-0 border-r border-surface-muted/40 last:border-r-0">{content}</div>
                );
              })}
            </div>
          ))}
        </div>
        </MonthShell>

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
      </>
    </AppShell>
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
      className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-card transition-transform duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99]"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ev.dotColor }} />
      <span className="min-w-0 flex-1 truncate font-medium">{ev.title}</span>
      {ev.care && <BabyIcon tone={ev.care.status === "offen" ? "offen" : "da"} />}
      <span className="tnum shrink-0 text-sm text-ink-muted">
        {ev.allDay ? "ganztägig" : ev.time}
      </span>
    </Link>
  );
}
