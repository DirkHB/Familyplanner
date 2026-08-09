/**
 * Der Riegel: Welche Tabellen gehören einem Haushalt, und was heißt das für
 * eine Abfrage?
 *
 * Reine Logik, absichtlich ohne Prisma und ohne Datenbank — damit sich die
 * Regeln prüfen lassen, ohne eine Abfrage zu stellen.
 *
 * Warum es das gibt: Ein vergessenes `where: { householdId }` wirft keine
 * Ausnahme. Es zeigt still die Termine einer anderen Familie. Bei rund
 * zweihundert Abfragen ist „gut aufpassen" keine Strategie — das ist der
 * Fehler, den man nicht durch Tests findet, sondern durch einen Anruf.
 *
 * Deshalb wird der Haushalt nicht erwartet, sondern eingesetzt. Wer ihn
 * vergisst, bekommt ihn trotzdem; wer ihn wirklich weglassen will, muss
 * `ueberAlleHaushalte()` hinschreiben.
 */

/**
 * Tabellen, an denen ein Haushalt hängt.
 *
 * Nicht dabei: `Household` und `Invite` (die stehen über den Haushalten),
 * sowie `Account`, `Session` und `VerificationToken` — das sind die Tabellen
 * der Anmeldung, die es gibt, bevor irgendein Haushalt feststeht.
 */
export const MANDANTEN_MODELLE = new Set([
  "User",
  "PushSubscription",
  "CalendarAccount",
  "Calendar",
  "Event",
  "EventDetail",
  "CareAssignment",
  "ShoppingList",
  "ShoppingItem",
  "Store",
  "Request",
  "Idea",
  "LearnedPattern",
  "AiFeedback",
  "ActivityLog",
  "TodoList",
  "Todo",
  "Briefing",
  "CareRule",
  "AppSetting",
]);

/** Operationen, die lesen — hier gehört der Haushalt in die Bedingung. */
export const LESEND = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

/** Operationen, die schreiben — hier gehört er zusätzlich in die Daten. */
export const SCHREIBEND = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

/**
 * Den Haushalt in eine Bedingung einsetzen.
 *
 * `findUnique` bekommt ihn nicht in `where` — dort sind nur eindeutige Felder
 * erlaubt, und Prisma weist alles andere ab. Die Prüfung passiert bei diesen
 * Abfragen hinterher am Ergebnis; das ist genauso sicher, weil eine Zeile aus
 * einem fremden Haushalt dann nicht zurückgegeben wird.
 */
export function mitFilter(where: unknown, householdId: string): Record<string, unknown> {
  const vorhanden = (where ?? {}) as Record<string, unknown>;
  // Über AND verknüpfen statt `householdId` zu überschreiben: Wer selbst schon
  // gefiltert hat, soll seinen Filter behalten — und wer einen fremden
  // Haushalt hineinschreibt, bekommt eine leere Antwort statt fremder Daten.
  return { AND: [vorhanden, { householdId }] };
}

/** Den Haushalt in einen Datensatz einsetzen (ein Datensatz oder viele). */
export function mitHaushaltsDaten(data: unknown, householdId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((d) => ({ householdId, ...(d as object) }));
  }
  // Der Haushalt steht vorn: Ein ausdrücklich gesetzter Wert gewinnt, damit
  // die Einrichtung eine Zeile für einen anderen Haushalt anlegen kann.
  return { householdId, ...((data ?? {}) as object) };
}

/** Gehört diese Zeile zu diesem Haushalt? Für Abfragen, die nicht filtern konnten. */
export function gehoertDazu(zeile: unknown, householdId: string): boolean {
  if (!zeile || typeof zeile !== "object") return true;
  const wert = (zeile as { householdId?: unknown }).householdId;
  return wert === undefined || wert === householdId;
}
