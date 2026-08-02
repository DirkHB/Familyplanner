import { UeberblickClient } from "@/app/ueberblick/UeberblickClient";
import { buildOverview } from "@/lib/overview/build";

export const dynamic = "force-dynamic";

/**
 * Öffentliche Vorschau des Überblicks mit Beispieldaten.
 *
 * Zeigt vor allem die zwei Fragen und ihre Umschaltung — die Stelle, an der
 * die gewählte Frage beim Zurückkommen aus einem Termin erhalten bleiben muss.
 */
export default async function VorschauUeberblick({
  searchParams,
}: {
  searchParams: Promise<{ frage?: string }>;
}) {
  const { frage } = await searchParams;
  const overview = buildOverview({
    events: [
      {
        dayKey: "2026-08-03",
        dayLabel: "Mo, 3. Aug",
        time: "18:00",
        title: "Sport · Volleyball",
        uid: "s-sport",
        allDay: false,
        care: "luecke",
        carePerson: null,
        occurrenceISO: "2026-08-03T16:00:00.000Z",
      },
      {
        dayKey: "2026-08-04",
        dayLabel: "Di, 4. Aug",
        time: "09:00",
        title: "Kinderarzt · U3",
        uid: "s-arzt",
        allDay: false,
        care: "da",
        carePerson: "dirk",
        occurrenceISO: "2026-08-04T07:00:00.000Z",
      },
    ],
    todos: [
      { id: "t1", title: "Kindergeld-Antrag abschicken", dueLabel: "Fr, 31. Juli", overdue: true, assignee: "dirk" },
      { id: "t2", title: "Kita-Anmeldung ausfüllen", dueLabel: null, overdue: false, assignee: null },
    ],
  });

  return (
    <UeberblickClient
      overview={overview}
      scopeLabel="Vorschau · ab jetzt bis Sonntag"
      briefing="Diese Woche steht eine Betreuung offen."
      otherHref="/vorschau/ueberblick"
      otherLabel="Nächste Woche"
      showToggle={false}
      initialTab={frage === "offen" ? "offen" : "woche"}
    />
  );
}
