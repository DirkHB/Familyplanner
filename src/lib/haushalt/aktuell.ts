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

  throw new Error(
    `Kein Haushalt für ${wofuer}. Innerhalb einer Anfrage kommt er aus der ` +
      "Sitzung; außerhalb (Worker, Einrichtung) muss er mit mitHaushalt(...) " +
      "gesetzt werden. Soll es wirklich über alle Haushalte gehen: " +
      "ueberAlleHaushalte(...).",
  );
}
