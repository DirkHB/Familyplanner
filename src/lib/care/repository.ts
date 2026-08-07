import "server-only";
import { prisma } from "@/lib/prisma";
import { createRequest, resolvePartner } from "@/lib/requests/repository";
import { displayNameForEmail } from "@/lib/auth/allowlist";
import { notifyUserId } from "@/lib/push/notify";
import { haushaltProfil } from "@/lib/haushalt/profil";
import { upsertCareBlock, removeCareBlock } from "./block-sync";

/**
 * Baby-Betreuung pro Termin-Vorkommen (eventUid + occurrenceDate).
 * Status: offen | zugesagt | geklaert | extern. Bei „offen" wird automatisch
 * eine Anfrage an den anderen erzeugt (Abschnitt 6.2); „extern" heißt: jemand
 * von außen (Oma, Opa, Babysitter) übernimmt, weil beide nicht können.
 */

export type CareStatus = "offen" | "zugesagt" | "geklaert" | "extern";

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

  // Der andere erfährt es sofort per Push — nicht erst beim nächsten Öffnen.
  try {
    const [me, event] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
      prisma.event.findFirst({ where: { uid: eventUid }, select: { title: true } }),
    ]);
    const partner = await resolvePartner(userId);
    if (me && partner) {
      await notifyUserId(partner.id, {
        title: `✓ ${me.name ?? displayNameForEmail(me.email)} ist bei ${(await haushaltProfil()).kind}`,
        body: event?.title ?? "Betreuung geklärt",
        url: `/termin/${encodeURIComponent(eventUid)}`,
        tag: `care-take-${eventUid}-${occurrenceDate.toISOString().slice(0, 10)}`,
      });
    }
  } catch {
    /* Push ist best effort — die Zusage steht auch ohne ihn. */
  }
  await schliesseKlaerungsAufgaben(eventUid);
  return result;
}

/**
 * „Babysitter geklärt" — beide können nicht, jemand von außen übernimmt.
 * `wer` ist der Name (Oma, Opa, Babysitter …) — er steht in der Notizspalte
 * der Zusage und im Kalenderblock („👶 Nicolas · Oma"), damit beide die
 * Absprache schwarz auf weiß haben.
 */
export async function externCare(eventUid: string, date: Date, wer?: string | null) {
  const occurrenceDate = dayStart(date);
  const name = wer?.trim() || null;
  const result = await prisma.careAssignment.upsert({
    where: { eventUid_occurrenceDate: { eventUid, occurrenceDate } },
    create: { eventUid, occurrenceDate, status: "extern", note: name },
    update: { status: "extern", responsibleUserId: null, note: name },
  });
  await upsertCareBlock(eventUid, occurrenceDate, null, name).catch(() => {});
  await schliesseKlaerungsAufgaben(eventUid);
  return result;
}

/**
 * „Frag ich heute Abend"-Aufgaben zu diesem Termin schließen, sobald die
 * Betreuung geklärt ist — egal von wem. Sonst erinnert eine Aufgabe an ein
 * Telefonat, das keiner mehr führen muss.
 */
async function schliesseKlaerungsAufgaben(eventUid: string) {
  await prisma.todo
    .updateMany({
      where: { sourceUid: { startsWith: `care-frage:${eventUid}:` }, status: "offen" },
      data: { status: "erledigt", completedAt: new Date() },
    })
    .catch(() => {});
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
  await schliesseKlaerungsAufgaben(eventUid);
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
    const req = await createRequest({
      fromUserId,
      question: `Kannst du bei „${eventTitle}" auf ${(await haushaltProfil()).kind} aufpassen?`,
      type: "yes_no",
      eventUid,
    });
    // Die Kennung braucht der Stapel, um die Anfrage bei „Rückgängig"
    // wieder einzusammeln, bevor sie beantwortet wird.
    return req.id;
  }
  return null;
}

/** Anzeigename + Person für die UI. */
export type CareView = {
  status: CareStatus;
  responsibleUserId: string | null;
};
