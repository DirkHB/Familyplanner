import "server-only";
import { prisma } from "@/lib/prisma";
import { notnameAusEmail } from "@/lib/auth/allowlist";
import { haushaltProfil, stelleUserSicher } from "@/lib/haushalt/profil";
import { notifyUserId } from "@/lib/push/notify";

export type RequestType = "yes_no" | "choice" | "free_text" | "date";

/**
 * Zwei-Personen-Modell: Anfragen gehen immer an den jeweils anderen — an die
 * andere Person DIESES Haushalts. Wohnt dort noch niemand sonst, gibt es
 * niemanden zu fragen, und die Anfrage unterbleibt, statt ins Leere zu gehen.
 */
export async function resolvePartner(
  userId: string,
): Promise<{ id: string; email: string; slot: string | null } | null> {
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me) return null;
  const profil = await haushaltProfil();
  const partnerEmail = profil.erwachsene.find(
    (e) => e.email !== me.email.toLowerCase(),
  )?.email;
  if (!partnerEmail) return null;
  const partner = await stelleUserSicher(partnerEmail);
  return { id: partner.id, email: partner.email, slot: partner.slot };
}

export async function createRequest(input: {
  fromUserId: string;
  question: string;
  type: RequestType;
  options?: string[];
  eventUid?: string | null;
  /** Das konkrete Vorkommen, falls die Frage einem Termin-Tag gilt. */
  occurrenceDate?: Date | null;
  dueDate?: Date | null;
}) {
  const partner = await resolvePartner(input.fromUserId);
  if (!partner) throw new Error("Partner nicht gefunden.");
  return prisma.request.create({
    data: {
      fromUserId: input.fromUserId,
      toUserId: partner.id,
      question: input.question,
      type: input.type,
      options: input.options ?? [],
      eventUid: input.eventUid ?? null,
      occurrenceDate: input.occurrenceDate ?? null,
      dueDate: input.dueDate ?? null,
      status: "open",
    },
  });
}

export async function answerRequest(id: string, userId: string, answer: string) {
  const req = await prisma.request.findUnique({
    where: { id },
    include: { toUser: true },
  });
  if (!req || req.toUserId !== userId) return null;
  const updated = await prisma.request.update({
    where: { id },
    data: { answer, status: "answered" },
  });

  // Antwort hat Konsequenzen: Betreuung setzen, Aufgabe anlegen, Fragesteller informieren.
  try {
    await applyAnswerEffects(req, answer);
  } catch {
    /* Effekte sind best effort — die Antwort selbst ist gespeichert. */
  }
  return updated;
}

type AnsweredRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  eventUid: string | null;
  occurrenceDate: Date | null;
  type: string;
  question: string;
  toUser: { email: string; name: string | null };
};

/** Verdrahtung Antwort → Wirkung (Abschnitt 6.2): „Ja" auf eine Betreuungsanfrage
 *  klärt die Betreuung, legt dem Übernehmenden eine Aufgabe an und pusht den anderen. */
async function applyAnswerEffects(req: AnsweredRequest, answer: string) {
  const answererName = req.toUser.name ?? notnameAusEmail(req.toUser.email);
  const yes = answer.trim().toLowerCase() === "ja";

  if (req.eventUid && req.type === "yes_no") {
    /*
     * Die Antwort gilt dem Vorkommen, nach dem gefragt wurde. Vorher stand
     * hier „die erste offene" — bei einer Serie klärte ein „Ja" zur Frage über
     * den 19. also den 12. und ließ den 19. offen. Anfragen von vor Migration
     * 0016 tragen kein Vorkommen; für die bleibt es beim alten Verhalten.
     */
    const assignment = req.occurrenceDate
      ? await prisma.careAssignment.findUnique({
          where: {
            eventUid_occurrenceDate: {
              eventUid: req.eventUid,
              occurrenceDate: req.occurrenceDate,
            },
          },
        })
      : await prisma.careAssignment.findFirst({
          where: { eventUid: req.eventUid, status: "offen" },
          orderBy: { occurrenceDate: "asc" },
        });
    const event = await prisma.event.findFirst({
      where: { uid: req.eventUid },
      select: { title: true },
    });
    const title = event?.title ?? "dem Termin";

    if (yes) {
      if (assignment) {
        await prisma.careAssignment.update({
          where: { id: assignment.id },
          data: { responsibleUserId: req.toUserId, status: "geklaert" },
        });
        // Zusage per „Ja" ist dieselbe Zusage wie „Ich mach das" — also
        // ebenfalls ein echter Eintrag im gemeinsamen Kalender.
        const { upsertCareBlock } = await import("@/lib/care/block-sync");
        await upsertCareBlock(req.eventUid, assignment.occurrenceDate, req.toUserId).catch(() => {});
      }
      await notifyUserId(req.fromUserId, {
        title: `✓ ${answererName} übernimmt die Betreuung`,
        body: title,
        url: `/termin/${encodeURIComponent(req.eventUid)}`,
        tag: `care-${req.id}`,
      });
    } else {
      await notifyUserId(req.fromUserId, {
        title: `${answererName} kann leider nicht`,
        body: `${title} — Betreuung ist weiter offen.`,
        url: `/termin/${encodeURIComponent(req.eventUid)}`,
        tag: `care-${req.id}`,
      });
    }
    return;
  }

  // Generische Anfrage: Fragesteller bekommt die Antwort als Push.
  await notifyUserId(req.fromUserId, {
    title: `${answererName} hat geantwortet`,
    body: `${req.question} → ${answer}`,
    url: "/anfragen",
    tag: `answer-${req.id}`,
  });
}

export async function declineRequest(id: string, userId: string) {
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req || req.toUserId !== userId) return null;
  return prisma.request.update({ where: { id }, data: { status: "declined" } });
}

export async function getOpenRequestsForUser(userId: string) {
  return prisma.request.findMany({
    where: { toUserId: userId, status: "open" },
    orderBy: { createdAt: "asc" },
    include: { fromUser: true },
  });
}

export async function listRequests(userId: string) {
  return prisma.request.findMany({
    where: { OR: [{ toUserId: userId }, { fromUserId: userId }] },
    orderBy: { createdAt: "desc" },
    include: { fromUser: true, toUser: true },
    take: 50,
  });
}
