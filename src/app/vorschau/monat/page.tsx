import { MonatsStrom, type StromMonat, type TagInfo } from "@/components/termine/MonatsRaster";
import { buildMonthMatrix, shiftMonth } from "@/lib/calendar/month";
import { dayKey } from "@/lib/calendar/format";

export const dynamic = "force-dynamic";

/**
 * Öffentliche Vorschau des Monatsstroms — drei Monate am Stück, durchgehend
 * scrollbar. Das Tages-Blatt öffnet sich beim Tipp; die Termine darin kommen
 * ohne Anmeldung nicht, hier zählt Raster und Fluss.
 */

const monatFmt = new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "UTC" });

export default function VorschauMonat() {
  const now = new Date();
  const todayKey = dayKey(now);
  const startKey = todayKey.slice(0, 7);

  const monate: StromMonat[] = Array.from({ length: 3 }, (_, i) => {
    const key = shiftMonth(startKey, i);
    return {
      key,
      monat: monatFmt.format(new Date(`${key}-01T00:00:00Z`)),
      jahr: key.slice(0, 4),
      weeks: buildMonthMatrix(key),
    };
  });

  const t1 = `${startKey}-05`;
  const t2 = `${startKey}-12`;
  const eventsByDay: Record<string, TagInfo> = {
    [t1]: {
      chips: [
        { t: "Kinderarzt", c: "#2A7E74" },
        { t: "Tennis", c: "#1F2A44" },
      ],
      n: 4,
    },
    [t2]: { chips: [{ t: "Zahnarzt", c: "#B4552D" }], n: 1 },
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg text-ink">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-24" style={{ touchAction: "pan-y" }}>
        <div className="mx-auto max-w-md">
          <MonatsStrom monate={monate} eventsByDay={eventsByDay} todayKey={todayKey} />
        </div>
      </div>
    </div>
  );
}
