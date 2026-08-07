import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/envelope";
import { haushaltId } from "./id";

/**
 * Die drei Dinge, von denen es „genau eins" gibt.
 *
 * Bisher suchte der Code sie mit `findFirst` — „die Einkaufsliste", „der
 * iCloud-Zugang". Das ist genau die Sorte Abfrage, die bei mehreren
 * Haushalten nicht scheitert, sondern stillschweigend den falschen
 * zurückgibt. Deshalb hat jede dieser Fragen ab jetzt genau eine Stelle,
 * und diese Stelle kennt den Haushalt.
 *
 * Heute ist die Antwort trivial, weil jede Datenbank einem Haushalt gehört.
 * Ändert sich das, sind es diese drei Funktionen — und nicht die zwölf
 * Aufrufer.
 */

/* --------------------------- 1. Die Einkaufsliste --------------------------- */

/**
 * Die Hauptliste des Haushalts. Legt sie an, falls es sie noch nicht gibt —
 * eine Einkaufsliste ist nichts, wofür man eingerichtet werden möchte.
 */
export async function hauptliste() {
  const vorhanden = await prisma.shoppingList.findFirst({
    where: { kind: "haupt" },
  });
  if (vorhanden) return vorhanden;
  return prisma.shoppingList.create({ data: { kind: "haupt", name: "Einkaufsliste" } });
}

/**
 * Als Filter für Abfragen, die Artikel der Hauptliste meinen, ohne sie erst
 * zu laden. Vorher stand `list: { kind: "haupt" }` an vier Stellen im Code.
 */
export const HAUPTLISTE_FILTER = { list: { kind: "haupt" } } as const;

/* ------------------------------ 2. Die Schalter ------------------------------ */

/**
 * Schalter des Haushalts. Der Schlüssel trägt den Haushalt, damit zwei
 * Haushalte nicht denselben Schalter umlegen.
 */
function flagKey(key: string): string {
  return `${haushaltId()}:${key}`;
}

export async function getHaushaltFlag(key: string, fallback = false): Promise<boolean> {
  try {
    // Erst unter dem neuen Schlüssel, dann unter dem alten: Schalter, die vor
    // dieser Änderung gesetzt wurden, sollen weiter gelten.
    const row =
      (await prisma.appSetting.findUnique({ where: { key: flagKey(key) } })) ??
      (await prisma.appSetting.findUnique({ where: { key } }));
    return row ? row.value === "an" : fallback;
  } catch {
    return fallback;
  }
}

export async function setHaushaltFlag(key: string, value: boolean): Promise<void> {
  const v = value ? "an" : "aus";
  await prisma.appSetting.upsert({
    where: { key: flagKey(key) },
    create: { key: flagKey(key), value: v },
    update: { value: v },
  });
}

/* --------------------------- 3. Der Kalenderzugang --------------------------- */

export type Kalenderzugang = {
  accountId: string;
  calendarId: string;
  calendarUrl: string;
  username: string;
  password: string;
};

/**
 * Über welches Konto schreibt dieser Haushalt in den Kalender?
 *
 * Das eigene zuerst, sonst das des Haushalts. Der Rückfall ist kein Luxus:
 * Wenn nur einer von beiden ein iCloud-Konto hat — etwa weil die andere ein
 * Android-Gerät nutzt —, konnte sie vorher keinen Termin anlegen, obwohl der
 * Kalender beiden gehört.
 */
export async function kalenderzugang(userId?: string | null): Promise<Kalenderzugang | null> {
  const mitKalendern = {
    calendars: { where: { isSynced: true }, orderBy: { name: "asc" as const } },
  };

  const eigenes = userId
    ? await prisma.calendarAccount.findFirst({
        where: { userId, provider: "icloud" },
        include: mitKalendern,
      })
    : null;
  const account =
    eigenes ??
    (await prisma.calendarAccount.findFirst({
      where: { provider: "icloud" },
      include: mitKalendern,
    }));

  const calendar = account?.calendars[0];
  if (!account || !calendar) return null;
  return {
    accountId: account.id,
    calendarId: calendar.id,
    calendarUrl: calendar.url,
    username: account.username ?? "",
    password: decryptSecret(account.credentialsEncrypted),
  };
}

/**
 * Gehört dieses Kalenderkonto zu diesem Haushalt? Heute immer ja — es gibt
 * nur einen. Die Frage steht trotzdem da, weil sie später den Unterschied
 * zwischen „darf löschen" und „darf nicht" ausmacht.
 */
export async function gehoertZumHaushalt(_accountId: string): Promise<boolean> {
  return true;
}
