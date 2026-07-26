import "server-only";
import { prisma } from "@/lib/prisma";
import { parseAllowlist, displayNameForEmail } from "@/lib/auth/allowlist";

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
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req || req.toUserId !== userId) return null;
  return prisma.request.update({
    where: { id },
    data: { answer, status: "answered" },
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
