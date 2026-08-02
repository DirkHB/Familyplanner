import "server-only";
import { prisma } from "@/lib/prisma";

/** Schalter, die für die App als Ganzes gelten. */

/**
 * Schreibt die App Betreuungsblöcke in den echten iCloud-Kalender?
 *
 * Standard ist AUS. Das ist die erste Funktion, die selbstständig Einträge im
 * gemeinsamen Kalender anlegt — das schaltet man bewusst ein, nachdem man das
 * Ergebnis einmal gesehen hat, und nicht durch ein Update.
 */
export const CARE_BLOCKS = "care.blocks";

export async function getFlag(key: string, fallback = false): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    return row ? row.value === "an" : fallback;
  } catch {
    return fallback;
  }
}

export async function setFlag(key: string, value: boolean): Promise<void> {
  const v = value ? "an" : "aus";
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: v },
    update: { value: v },
  });
}
