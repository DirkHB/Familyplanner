import "server-only";
import { prisma } from "@/lib/prisma";
import type { Platz } from "@/lib/haushalt/platz";
import { computeFairness, type Fairness } from "./compute";

/** Fairness über die letzten `weeks` Wochen (Standard 6) aus den Betreuungs-Zuweisungen. */
export async function getFairness(weeks = 6, now: Date = new Date()): Promise<Fairness> {
  const since = new Date(now.getTime() - weeks * 7 * 86_400_000);
  const rows = await prisma.careAssignment.findMany({
    where: { occurrenceDate: { gte: since }, status: { in: ["geklaert", "zugesagt"] } },
    include: { responsible: true },
  });
  return computeFairness(
    rows.map((r) => ({
      person: (r.responsible?.slot as Platz | null) ?? null,
    })),
  );
}
