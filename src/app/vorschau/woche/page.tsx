import { WeekView } from "@/components/week/WeekView";
import { buildWeek } from "@/lib/calendar/view-model";
import { buildSampleWeek } from "@/lib/calendar/sample";
import { formatDateHeader, startOfDayBerlin } from "@/lib/calendar/format";
import { wochenBriefing } from "@/lib/calendar/wochen-briefing";

export const dynamic = "force-dynamic";

/** Öffentliche Vorschau mit Beispiel-Daten — zeigt die Wochenansicht ohne Login/DB. */
export default function VorschauWoche() {
  const now = new Date();
  const { occurrences, metaByUid } = buildSampleWeek(now);
  // Derselbe Zeitraum wie auf der echten Woche — sonst zieht ein ganztägiger
  // Eintrag, der vorletzte Woche begann, die Liste in die Vergangenheit.
  const von = startOfDayBerlin(now);
  const days = buildWeek(occurrences, metaByUid, now, undefined, undefined, {
    von,
    bis: new Date(von.getTime() + 10 * 86_400_000),
  });
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
      whenLabel: "Do, 6. August, 16:00",
    },
  ];
  const heute = days[0];
  const briefing = wochenBriefing({
    heute: (heute?.events ?? []).map((e) => ({
      time: e.time,
      title: e.title,
      past: e.past,
      allDay: e.allDay,
      careOffen: e.care?.status === "offen",
    })),
    naechster: null,
    aufgabenHeute: 2,
  });

  return (
    <WeekView
      greetingName="Dirk"
      dateLabel={`Vorschau · ${formatDateHeader(now)}`}
      days={days}
      requests={requests}
      briefing={briefing}
    />
  );
}
