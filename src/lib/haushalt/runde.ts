import "server-only";
import { prismaRoh } from "@/lib/prisma";
import { mitHaushalt } from "./kontext";

/**
 * Eine Runde durch alle Haushalte.
 *
 * Die Hintergrundaufgaben — Sync, Briefing, Erinnerungen — hatten bisher
 * keinen Haushalt und brauchten auch keinen: Es gab nur einen. Jetzt gibt es
 * mehrere, und der Riegel bricht ab, wenn keiner gesetzt ist. Das ist die
 * einzige Stelle, die ihn für sie setzt.
 *
 * Ein Haushalt, bei dem es schiefgeht, beendet die Runde nicht. Sonst hinge
 * das Briefing aller anderen an einem abgelaufenen iCloud-Passwort in einer
 * fremden Familie — und niemand käme darauf, dort zu suchen.
 */
export async function proHaushalt<T extends Record<string, number>>(
  fn: () => Promise<T>,
): Promise<T & { haushalte: number; fehler: number }> {
  const haushalte = await prismaRoh.household.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const summe: Record<string, number> = {};
  let fehler = 0;

  for (const { id } of haushalte) {
    try {
      const teil = await mitHaushalt(id, fn);
      for (const [schluessel, wert] of Object.entries(teil)) {
        if (typeof wert === "number") summe[schluessel] = (summe[schluessel] ?? 0) + wert;
      }
    } catch (err) {
      fehler++;
      // Der Haushalt steht im Log, der Inhalt nicht: Was schiefging, gehört
      // in die Fehlermeldung; wessen Termine betroffen sind, geht niemanden
      // an, der das Log liest.
      console.error(
        JSON.stringify({
          service: "runde",
          householdId: id,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return { ...(summe as T), haushalte: haushalte.length, fehler };
}

/**
 * Dasselbe für Läufe, die nichts zu zählen haben.
 *
 * Getrennt, weil `proHaushalt` sonst so tun müsste, als wäre `void` eine Zahl.
 */
export async function proHaushaltStill(
  fn: () => Promise<unknown>,
): Promise<{ haushalte: number; fehler: number }> {
  return proHaushalt(async () => {
    await fn();
    return {};
  });
}
