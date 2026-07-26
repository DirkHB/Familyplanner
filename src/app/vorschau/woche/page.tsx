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
  const requests = [
    {
      id: "s-req",
      question: "Schaffst du Donnerstag den Einkauf?",
      type: "yes_no" as const,
      options: [],
      fromName: "Constanze",
      fromPerson: "constanze" as const,
      ageLabel: "vor 20 Min.",
      overdue: false,
    },
  ];
  return (
    <WeekView
      greetingName="Dirk"
      dateLabel={`Vorschau · ${formatDateHeader(now)}`}
      days={days}
      requests={requests}
    />
  );
}
