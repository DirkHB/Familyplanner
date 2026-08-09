import "server-only";
import { prisma } from "@/lib/prisma";
import type { Platz as Person } from "@/lib/haushalt/platz";

/** Ideen- & Urlaubsboard (Abschnitt 6.5). Bewertung durch beide, Umwandlung in Termine. */

export type IdeaType = "urlaub" | "ausflug" | "restaurant" | "geschenk";
const TYPES: IdeaType[] = ["urlaub", "ausflug", "restaurant", "geschenk"];

export type Votes = { dirk: boolean; constanze: boolean };

export type IdeaVM = {
  id: string;
  type: IdeaType;
  title: string;
  description: string | null;
  imageUrl: string | null;
  targetPeriod: string | null;
  votes: Votes;
  status: string;
};

function toVotes(raw: unknown): Votes {
  const v = (raw ?? {}) as Partial<Votes>;
  return { dirk: !!v.dirk, constanze: !!v.constanze };
}

function firstImage(raw: unknown): string | null {
  return Array.isArray(raw) && typeof raw[0] === "string" ? raw[0] : null;
}

export async function listIdeas(): Promise<IdeaVM[]> {
  const rows = await prisma.idea.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map((r) => ({
    id: r.id,
    type: (TYPES.includes(r.type as IdeaType) ? r.type : "ausflug") as IdeaType,
    title: r.title,
    description: r.description,
    imageUrl: firstImage(r.images),
    targetPeriod: r.targetPeriod,
    votes: toVotes(r.votes),
    status: r.status,
  }));
}

export async function createIdea(input: {
  type: IdeaType;
  title: string;
  description?: string;
  link?: string;
  imageUrl?: string;
  targetPeriod?: string;
}) {
  return prisma.idea.create({
    data: {
      type: TYPES.includes(input.type) ? input.type : "ausflug",
      title: input.title.trim(),
      description: input.description?.trim() || null,
      link: input.link?.trim() || null,
      images: input.imageUrl ? [input.imageUrl.trim()] : [],
      targetPeriod: input.targetPeriod?.trim() || null,
      votes: { dirk: false, constanze: false },
      status: "offen",
    },
  });
}

export async function toggleVote(id: string, person: Person) {
  const idea = await prisma.idea.findUnique({ where: { id } });
  if (!idea) return;
  const votes = toVotes(idea.votes);
  votes[person] = !votes[person];
  await prisma.idea.update({ where: { id }, data: { votes } });
}

export async function deleteIdea(id: string) {
  await prisma.idea.delete({ where: { id } }).catch(() => null);
}

export async function markIdeaPlanned(id: string) {
  await prisma.idea.update({ where: { id }, data: { status: "geplant" } }).catch(() => null);
}

export async function updateIdea(
  id: string,
  input: { title?: string; description?: string; targetPeriod?: string; imageUrl?: string },
) {
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title.trim() || undefined;
  if (input.description !== undefined) data.description = input.description.trim() || null;
  if (input.targetPeriod !== undefined) data.targetPeriod = input.targetPeriod.trim() || null;
  if (input.imageUrl !== undefined) data.images = input.imageUrl.trim() ? [input.imageUrl.trim()] : [];
  await prisma.idea.update({ where: { id }, data }).catch(() => null);
}
