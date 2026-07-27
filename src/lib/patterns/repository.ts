import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Gelernte Muster (Abschnitt 6.4): im UI lesbar & editierbar. Fließen als
 * „Bekannte Vorlieben" in den Planungs-Kontext ein. Start: manuell pflegbar,
 * später ergänzt die KI Vorschläge (source = "gelernt").
 */

export type PatternVM = {
  id: string;
  label: string;
  isActive: boolean;
  source: string;
};

export async function listPatterns(): Promise<PatternVM[]> {
  const rows = await prisma.learnedPattern.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });
  return rows.map((r) => ({ id: r.id, label: r.label, isActive: r.isActive, source: r.source }));
}

/** Nur aktive Muster, als kurze Labels für den Kontextaufbau. */
export async function activePatternLabels(): Promise<string[]> {
  const rows = await prisma.learnedPattern.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map((r) => r.label);
}

export async function createPattern(label: string) {
  const clean = label.trim();
  if (!clean) return null;
  return prisma.learnedPattern.create({
    data: { label: clean, pattern: {}, source: "manuell", isActive: true },
  });
}

export async function togglePattern(id: string) {
  const row = await prisma.learnedPattern.findUnique({ where: { id } });
  if (!row) return;
  await prisma.learnedPattern.update({ where: { id }, data: { isActive: !row.isActive } });
}

export async function updatePatternLabel(id: string, label: string) {
  const clean = label.trim();
  if (!clean) return;
  await prisma.learnedPattern.update({ where: { id }, data: { label: clean } });
}

export async function deletePattern(id: string) {
  await prisma.learnedPattern.delete({ where: { id } }).catch(() => null);
}
