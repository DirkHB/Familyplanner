import "server-only";
import { prisma } from "@/lib/prisma";
import { createRequest, resolvePartner } from "@/lib/requests/repository";

/**
 * Baby-Betreuung pro Termin-Vorkommen (eventUid + occurrenceDate).
 * Status: offen | zugesagt | geklaert. Bei „offen" wird automatisch eine Anfrage
 * an den anderen erzeugt (Abschnitt 6.2).
 */

export type CareStatus = "offen" | "zugesagt" | "geklaert";

function dayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function getCareForOccurrence(eventUid: string, date: Date) {
  return prisma.careAssignment.findUnique({
    where: { eventUid_occurrenceDate: { eventUid, occurrenceDate: dayStart(date) } },
  });
}

/** „Ich mache es" — Betreuung übernehmen, Status geklärt + Auto-Aufgabe. */
export async function takeCare(eventUid: string, date: Date, userId: string) {
  const occurrenceDate = dayStart(date);
  // Bewusst KEINE Aufgabe daraus machen: Betreuung ist eine Zusage für ein
  // Zeitfenster, keine Aufgabe. Sie lässt sich nicht vorziehen, nicht auf
  // morgen schieben und nicht „früher erledigen". Sie steht am Termin und im
  // Betreuungsbereich — dort mit Uhrzeit und Person.
  return prisma.careAssignment.upsert({
    where: { eventUid_occurrenceDate: { eventUid, occurrenceDate } },
    create: { eventUid, occurrenceDate, responsibleUserId: userId, status: "geklaert" },
    update: { responsibleUserId: userId, status: "geklaert" },
  });
}

/** „Braucht keine Betreuung" — Termin aus der Betreuungslogik nehmen (kein Icon mehr). */
export async function dismissCare(eventUid: string, date: Date) {
  const occurrenceDate = dayStart(date);
  return prisma.careAssignment.upsert({
    where: { eventUid_occurrenceDate: { eventUid, occurrenceDate } },
    create: { eventUid, occurrenceDate, status: "keine" },
    update: { status: "keine", responsibleUserId: null },
  });
}

/** „Offen" markieren → erzeugt automatisch eine Ja/Nein-Anfrage an den Partner. */
export async function requestCare(
  eventUid: string,
  date: Date,
  fromUserId: string,
  eventTitle: string,
) {
  const occurrenceDate = dayStart(date);
  await prisma.careAssignment.upsert({
    where: { eventUid_occurrenceDate: { eventUid, occurrenceDate } },
    create: { eventUid, occurrenceDate, status: "offen" },
    update: { status: "offen", responsibleUserId: null },
  });

  const partner = await resolvePartner(fromUserId);
  if (partner) {
    await createRequest({
      fromUserId,
      question: `Kannst du bei „${eventTitle}" aufs Baby aufpassen?`,
      type: "yes_no",
      eventUid,
    });
  }
}

/** Anzeigename + Person für die UI. */
export type CareView = {
  status: CareStatus;
  responsibleUserId: string | null;
};
