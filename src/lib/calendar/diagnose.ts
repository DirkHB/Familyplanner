import "server-only";
import { prisma } from "@/lib/prisma";
import { participantsOf, nameHintFromTitle } from "./attribution";

/**
 * Was steht eigentlich in unseren Terminen?
 *
 * Bevor wir Constanze und Dirk von Hand zuordnen lassen, wen ein Termin
 * bindet, schauen wir nach, ob die Information nicht schon da ist: iCloud legt
 * bei geteilten Kalendern häufig ORGANIZER und ATTENDEE ab, und manchmal steht
 * der Name schlicht im Titel. Das hier ist die Antwort auf die Frage
 * „brauchen wir überhaupt Handarbeit?".
 */

export type CalendarDiagnose = {
  name: string;
  isSynced: boolean;
  termine: number;
  mitOrganizer: number;
  mitAttendee: number;
  /** Wer legt die Termine an — die häufigsten Adressen. */
  ersteller: { mail: string; anzahl: number }[];
  /** Termine, deren Titel eindeutig auf Constanze oder Dirk zeigt. */
  titelMitName: number;
};

export async function diagnoseCalendars(): Promise<CalendarDiagnose[]> {
  const calendars = await prisma.calendar.findMany({
    select: { id: true, name: true, isSynced: true },
    orderBy: { name: "asc" },
  });

  const out: CalendarDiagnose[] = [];
  for (const cal of calendars) {
    const events = await prisma.event.findMany({
      where: { calendarId: cal.id },
      select: { title: true, rawIcs: true },
      take: 2000,
    });

    let mitOrganizer = 0;
    let mitAttendee = 0;
    let titelMitName = 0;
    const zaehler = new Map<string, number>();

    for (const e of events) {
      const p = participantsOf(e.rawIcs);
      if (p.organizer) {
        mitOrganizer++;
        zaehler.set(p.organizer, (zaehler.get(p.organizer) ?? 0) + 1);
      }
      if (p.attendees.length) mitAttendee++;
      if (nameHintFromTitle(e.title)) titelMitName++;
    }

    out.push({
      name: cal.name,
      isSynced: cal.isSynced,
      termine: events.length,
      mitOrganizer,
      mitAttendee,
      ersteller: [...zaehler.entries()]
        .map(([mail, anzahl]) => ({ mail, anzahl }))
        .sort((a, b) => b.anzahl - a.anzahl)
        .slice(0, 4),
      titelMitName,
    });
  }
  return out;
}
