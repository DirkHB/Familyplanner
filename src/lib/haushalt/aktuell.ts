import "server-only";
import { gesetzterHaushalt } from "./kontext";

/**
 * Welcher Haushalt ist gerade dran?
 *
 * Ausdrücklich gesetzt gewinnt (Worker, Einrichtung, Einladung). Sonst kommt
 * er aus der Sitzung. Findet sich keiner, wird abgebrochen — lieber ein
 * Fehler als eine Antwort, in der fremde Daten stehen könnten.
 *
 * Der Import der Anmeldung passiert erst in der Funktion: `auth()` liest
 * selbst aus der Datenbank, und ein Import auf Modulebene ergäbe einen Ring
 * über lib/prisma.
 */
export async function aktuellerHaushalt(wofuer = "diese Abfrage"): Promise<string> {
  const gesetzt = gesetzterHaushalt();
  if (gesetzt) return gesetzt;

  const { auth } = await import("@/auth");
  const session = await auth().catch(() => null);
  const id = (session?.user as { householdId?: string } | undefined)?.householdId;
  if (id) return id;

  /*
   * Ein angemeldeter Mensch ohne Haushalt im Token: Das sind die Sitzungen,
   * die es vor dieser Änderung schon gab. Ihr Token läuft ein Jahr, und
   * niemanden dafür abzumelden, dass wir etwas umgebaut haben, wäre die
   * falsche Art, ehrlich zu sein. Einmal nachschlagen, dann steht es beim
   * nächsten Anmelden wieder im Token.
   */
  const userId = session?.user?.id;
  if (userId) {
    const { prismaRoh } = await import("@/lib/prisma");
    const zeile = await prismaRoh.user
      .findUnique({ where: { id: userId }, select: { householdId: true } })
      .catch(() => null);
    if (zeile?.householdId) return zeile.householdId;
  }

  throw new Error(
    `Kein Haushalt für ${wofuer}. Innerhalb einer Anfrage kommt er aus der ` +
      "Sitzung; außerhalb (Worker, Einrichtung) muss er mit mitHaushalt(...) " +
      "gesetzt werden. Soll es wirklich über alle Haushalte gehen: " +
      "ueberAlleHaushalte(...).",
  );
}
