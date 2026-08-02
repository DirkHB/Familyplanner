import { MonatsRaster, type RasterEvent } from "@/components/termine/MonatsRaster";
import { buildMonthMatrix, monthTitle } from "@/lib/calendar/month";
import { dayKey } from "@/lib/calendar/format";

export const dynamic = "force-dynamic";

/**
 * Öffentliche Vorschau des Monatsrasters — prüft die zwei Tipp-Stufen:
 * springen, dann Anlege-Blatt. Das Anlegen selbst schlägt ohne Anmeldung
 * fehl; hier zählt der Weg dorthin.
 */
export default function VorschauMonat() {
  const now = new Date();
  const todayKey = dayKey(now);
  const monthKey = todayKey.slice(0, 7);
  const weeks = buildMonthMatrix(monthKey);

  const t1 = `${monthKey}-05`;
  const t2 = `${monthKey}-12`;
  const eventsByDay: Record<string, RasterEvent[]> = {
    [t1]: [
      { key: "a", title: "Kinderarzt · U3", dotColor: "#2A7E74" },
      { key: "b", title: "Tennis", dotColor: "#1F2A44" },
    ],
    [t2]: [{ key: "c", title: "Zahnarzt", dotColor: "#B4552D" }],
  };

  return (
    <div className="min-h-dvh bg-bg px-5 pt-8 text-ink">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl">{monthTitle(monthKey)}</h1>
        <MonatsRaster
          weeks={weeks}
          todayKey={todayKey}
          eventsByDay={eventsByDay}
          kurz={{ a: "Kinderarzt", b: "Tennis", c: "Zahnarzt" }}
        />
        {/* Sprungziele wie auf der echten Seite */}
        <div className="mt-8 flex flex-col gap-5 pb-40">
          {[t1, t2].map((k) => (
            <div key={k} id={k} className="rounded-card bg-surface p-4 shadow-card">
              <p className="font-display text-xl">Tagesgruppe {k}</p>
              <p className="text-sm text-ink-muted">Hierher springt der erste Tipp.</p>
            </div>
          ))}
          <div className="h-[70vh]" />
        </div>
      </div>
    </div>
  );
}
