import Link from "next/link";
import { TabBar } from "@/components/app/TabBar";
import { buildWeek, type DayVM, type EventVM } from "@/lib/calendar/view-model";
import { getOccurrencesForRange, getMetaByUid } from "@/lib/calendar/repository";
import { startOfDayBerlin } from "@/lib/calendar/format";

export const dynamic = "force-dynamic";

const monthFmt = new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "Europe/Berlin" });

/** Termine: Agenda der nächsten 6 Wochen — der Blick weiter voraus als die Woche. */
export default async function TerminePage() {
  const now = new Date();
  const from = startOfDayBerlin(now);
  const to = new Date(from.getTime() + 42 * 86_400_000);

  const occurrences = await getOccurrencesForRange(from, to);
  const uids = [...new Set(occurrences.map((o) => o.uid))];
  const meta = await getMetaByUid(uids);
  const days = buildWeek(occurrences, meta, now);

  // Nach Monat gruppieren (Tages-Key ist YYYY-MM-DD in Berliner Zeit).
  const months: { label: string; days: DayVM[] }[] = [];
  for (const day of days) {
    const label = monthFmt.format(new Date(`${day.key}T12:00:00Z`));
    const last = months[months.length - 1];
    if (last && last.label === label) last.days.push(day);
    else months.push({ label, days: [day] });
  }

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-28 pt-8">
        <h1 className="font-display text-4xl">Termine</h1>
        <p className="mt-2 text-ink-muted">Die nächsten sechs Wochen im Überblick</p>

        {days.length === 0 ? (
          <div className="mt-10 rounded-card bg-surface p-6 text-center shadow-card">
            <p className="font-display text-xl">Nichts geplant</p>
            <p className="mt-2 text-ink-muted">In den nächsten sechs Wochen ist alles frei.</p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-8">
            {months.map((m) => (
              <section key={m.label}>
                <h2 className="eyebrow mb-4 text-accent">{m.label}</h2>
                <div className="flex flex-col gap-5">
                  {m.days.map((day) => (
                    <DayBlock key={day.key} day={day} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <TabBar />
    </div>
  );
}

function DayBlock({ day }: { day: DayVM }) {
  return (
    <div className="flex gap-4">
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
