import { WeekView } from "@/components/week/WeekView";
import { buildWeek } from "@/lib/calendar/view-model";
import { buildSampleWeek } from "@/lib/calendar/sample";
import { formatDateHeader } from "@/lib/calendar/format";

export const dynamic = "force-dynamic";

/** Öffentliche Vorschau mit Beispiel-Daten — zeigt die Wochenansicht ohne Login/DB. */
export default function VorschauWoche() {
  const now = new Date();
  const { occurrences, metaByUid } = buildSampleWeek(now);
  const days = buildWeek(occurrences, metaByUid, now);
  return (
    <WeekView greetingName="Constanze" dateLabel={`Vorschau · ${formatDateHeader(now)}`} days={days} />
  );
}
