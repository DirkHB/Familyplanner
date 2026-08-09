import "server-only";
import { prisma } from "@/lib/prisma";
import { aktuellerHaushalt } from "@/lib/haushalt/aktuell";
import { titleKey } from "./gaps";

/**
 * „Dafür braucht es nie eine Betreuung." Wird pro Titel-Art gemerkt, nicht pro
 * Vorkommen — sonst müsste man die wöchentliche Müllabfuhr jede Woche wieder
 * abwinken, und genau daran stirbt so eine Funktion.
 *
 * Die Regel gehört dem Haushalt, nicht der Datenbank: Winkt einer „Schwimmkurs"
 * ab, ist das keine Aussage über die Schwimmkurse aller anderen.
 */

export async function getDismissedTitleKeys(): Promise<Set<string>> {
  const rows = await prisma.careRule.findMany({
    where: { decision: "keine" },
    select: { titleKey: true },
  });
  return new Set(rows.map((r) => r.titleKey));
}

export async function dismissTitle(title: string, userId?: string): Promise<void> {
  const key = titleKey(title);
  if (!key) return;
  const haushalt = await aktuellerHaushalt("Betreuungsregel");
  await prisma.careRule.upsert({
    // Der zusammengesetzte Schlüssel muss den Haushalt nennen: Bei Abfragen
    // über einen eindeutigen Schlüssel lässt Prisma nichts anderes zu, der
    // Riegel kann ihn dort also nicht einsetzen.
    where: { householdId_titleKey: { householdId: haushalt, titleKey: key } },
    create: { titleKey: key, decision: "keine", createdBy: userId ?? null },
    update: { decision: "keine" },
  });
}

/** Zurücknehmen — falls doch einmal falsch abgewinkt. */
export async function undismissTitle(title: string): Promise<void> {
  await prisma.careRule.deleteMany({
    where: { titleKey: titleKey(title) },
  });
}

export async function listDismissed(): Promise<{ titleKey: string; createdAt: Date }[]> {
  return prisma.careRule.findMany({
    where: { decision: "keine" },
    select: { titleKey: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}
