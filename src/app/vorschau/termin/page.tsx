import { EventDetail } from "@/components/event/EventDetail";
import { buildDetailVM } from "@/lib/calendar/view-model";
import { startOfDayBerlin } from "@/lib/calendar/format";

export const dynamic = "force-dynamic";

/** Öffentliche Vorschau des Termin-Details (Beispiel Kinderarzt · U3), ohne Login/DB. */
export default function VorschauTermin() {
  const base = startOfDayBerlin(new Date()).getTime();
  const start = new Date(base + 86_400_000 + 10 * 3_600_000 + 15 * 60_000);
  const vm = buildDetailVM(
    {
      uid: "s-arzt",
      title: "Kinderarzt · U3",
      location: "Praxis Dr. Behrens",
      start,
      end: new Date(start.getTime() + 45 * 60_000),
      allDay: false,
      category: "arzt",
      notes: "Fragen zu Schlaf & Beikoststart mitnehmen.",
      occurrenceISO: start.toISOString(),
      care: { status: "geklaert", responsibleName: "Dirk", responsiblePerson: "dirk" },
      // Zeigt die Zeile „In … Kalender" — sichtbar, sobald jeder seinen
      // eigenen Kalender mitbringt.
      kalenderPlatz: "dirk",
      prepChecklist: [
        { text: "Versichertenkarte", done: true },
        { text: "U-Heft", done: true },
        { text: "Impfpass", done: false },
        { text: "Wickeltasche", done: false },
        { text: "Fragen an den Arzt", done: false },
      ],
    },
    true, // readOnly in der Vorschau
  );
  return (
    <EventDetail
      vm={vm}
      shopping={{
        linked: [
          { id: "a", text: "Fiebersaft", checked: false },
          { id: "b", text: "Feuchttücher", checked: true },
        ],
        linkable: [
          { id: "c", text: "Windeln Größe 2" },
          { id: "d", text: "Haferdrink" },
        ],
      }}
    />
  );
}
