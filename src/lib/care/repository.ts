import "server-only";
import { prisma } from "@/lib/prisma";
import { createRequest, resolvePartner } from "@/lib/requests/repository";
import { upsertCareBlock, removeCareBlock } from "./block-sync";

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
  const result = await prisma.careAssignment.upsert({
    where: { eventUid_occurrenceDate: { eventUid, occurrenceDate } },
    create: { eventUid, occurrenceDate, responsibleUserId: userId, status: "geklaert" },
    update: { responsibleUserId: userId, status: "geklaert" },
  });

  // Und als echter Termin in den gemeinsamen Kalender — damit die Zusage auf
  // dem Sperrbildschirm steht und der andere sie sofort sieht.
  await upsertCareBlock(eventUid, occurrenceDate, userId).catch(() => {});
  return result;
}

/** „Braucht keine Betreuung" — Termin aus der Betreuungslogik nehmen (kein Icon mehr). */
export async function dismissCare(eventUid: string, date: Date) {
  const occurrenceDate = dayStart(date);
  const result = await prisma.careAssignment.upsert({
    where: { eventUid_occurrenceDate: { eventUid, occurrenceDate } },
    create: { eventUid, occurrenceDate, status: "keine" },
    update: { status: "keine", responsibleUserId: null },
  });
  // Niemand übernimmt mehr — dann darf auch kein Block im Kalender stehen.
  await removeCareBlock(eventUid, occurrenceDate).catch(() => {});
  return result;
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
  // Wieder offen heißt: Der bisherige Block gilt nicht mehr.
  await removeCareBlock(eventUid, occurrenceDate).catch(() => {});

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
