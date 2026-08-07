import "server-only";
import { prisma } from "@/lib/prisma";
import { haushaltId } from "@/lib/haushalt/id";
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
    where: { householdId: haushaltId(), decision: "keine" },
    select: { titleKey: true },
  });
  return new Set(rows.map((r) => r.titleKey));
}

export async function dismissTitle(title: string, userId?: string): Promise<void> {
  const key = titleKey(title);
  if (!key) return;
  await prisma.careRule.upsert({
    where: { householdId_titleKey: { householdId: haushaltId(), titleKey: key } },
    create: { householdId: haushaltId(), titleKey: key, decision: "keine", createdBy: userId ?? null },
    update: { decision: "keine" },
  });
}

/** Zurücknehmen — falls doch einmal falsch abgewinkt. */
export async function undismissTitle(title: string): Promise<void> {
  await prisma.careRule.deleteMany({
    where: { householdId: haushaltId(), titleKey: titleKey(title) },
  });
}

export async function listDismissed(): Promise<{ titleKey: string; createdAt: Date }[]> {
  return prisma.careRule.findMany({
    where: { householdId: haushaltId(), decision: "keine" },
    select: { titleKey: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}
