import { EventDetail } from "@/components/event/EventDetail";
import { buildDetailVM } from "@/lib/calendar/view-model";
import { startOfDayBerlin } from "@/lib/calendar/format";
import { careBlockTitle, careBlockUid } from "@/lib/care/block";

export const dynamic = "force-dynamic";

/**
 * Öffentliche Vorschau eines Betreuungsblocks — des Eintrags, den die App
 * selbst in den gemeinsamen Kalender schreibt. Bewusst nicht readOnly: Der
 * einzige Knopf, den es hier gibt, ist der Grund für diese Seite.
 */
export default function VorschauBetreuung() {
  const base = startOfDayBerlin(new Date()).getTime();
  const start = new Date(base + 86_400_000 + 18 * 3_600_000);
  const vm = buildDetailVM({
    uid: careBlockUid("s-abendtermin@icloud.com", "2026-08-03"),
    title: careBlockTitle("dirk"),
    location: null,
    start,
    end: new Date(start.getTime() + 3_600_000),
    allDay: false,
    category: "sonstiges",
    notes: "",
    occurrenceISO: start.toISOString(),
    care: null,
    prepChecklist: [],
  });
  return <EventDetail vm={vm} shopping={null} />;
}
