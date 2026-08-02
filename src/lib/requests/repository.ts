import "server-only";
import { prisma } from "@/lib/prisma";
import { parseAllowlist, displayNameForEmail } from "@/lib/auth/allowlist";
import { notifyUserId } from "@/lib/push/notify";

export type RequestType = "yes_no" | "choice" | "free_text" | "date";

/**
 * Zwei-Personen-Modell: Anfragen gehen immer an den jeweils anderen. Wir stellen sicher,
 * dass beide Nutzerzeilen existieren (aus der Allowlist), damit Anfragen nie ins Leere gehen.
 */
export async function resolvePartner(userId: string): Promise<{ id: string; email: string } | null> {
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me) return null;
  const others = parseAllowlist(process.env.ALLOWED_EMAILS).filter(
    (e) => e.toLowerCase() !== me.email.toLowerCase(),
  );
  const partnerEmail = others[0];
  if (!partnerEmail) return null;
  const partner = await prisma.user.upsert({
    where: { email: partnerEmail },
    create: { email: partnerEmail, name: displayNameForEmail(partnerEmail) },
    update: {},
  });
  return { id: partner.id, email: partner.email };
}

export async function createRequest(input: {
  fromUserId: string;
  question: string;
  type: RequestType;
  options?: string[];
  eventUid?: string | null;
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
  type: string;
  question: string;
  toUser: { email: string; name: string | null };
};

/** Verdrahtung Antwort → Wirkung (Abschnitt 6.2): „Ja" auf eine Betreuungsanfrage
 *  klärt die Betreuung, legt dem Übernehmenden eine Aufgabe an und pusht den anderen. */
async function applyAnswerEffects(req: AnsweredRequest, answer: string) {
  const answererName = req.toUser.name ?? displayNameForEmail(req.toUser.email);
  const yes = answer.trim().toLowerCase() === "ja";

  if (req.eventUid && req.type === "yes_no") {
    const assignment = await prisma.careAssignment.findFirst({
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
