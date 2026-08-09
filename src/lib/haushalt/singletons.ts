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

/** Aus einem Kalender samt Konto den Zugang bauen. */
function zugangAus(
  calendar: { id: string; url: string },
  account: { id: string; username: string | null; credentialsEncrypted: string },
): Kalenderzugang {
  return {
    accountId: account.id,
    calendarId: calendar.id,
    calendarUrl: calendar.url,
    username: account.username ?? "",
    password: decryptSecret(account.credentialsEncrypted),
  };
}

/**
 * In welchen Kalender schreibt die App für diese Person?
 *
 * Erst das, was sie selbst festgelegt hat. Dann ihr eigenes Konto. Erst zuletzt
 * irgendeines des Haushalts.
 *
 * Diese Reihenfolge ist der ganze Punkt: Vorher stand der Rückfall an erster
 * Stelle, sobald jemand kein eigenes Konto hatte — und dann landete ihr Termin
 * im Kalender des anderen. Für uns fiel das nie auf, wir teilen einen Kalender.
 * In einem Haushalt, in dem jeder seinen eigenen mitbringt, schreibt so ein
 * Mensch in fremde Termine hinein.
 *
 * Der Rückfall bleibt trotzdem: Wer noch nichts festgelegt hat, soll etwas
 * eintragen können. Er ist jetzt nur die letzte Antwort statt der ersten.
 */
export async function kalenderzugang(userId?: string | null): Promise<Kalenderzugang | null> {
  const mitKonto = { account: true };

  if (userId) {
    const ich = await prisma.user.findUnique({
      where: { id: userId },
      select: { schreibKalenderId: true },
    });
    if (ich?.schreibKalenderId) {
      const gewaehlt = await prisma.calendar.findUnique({
        where: { id: ich.schreibKalenderId },
        include: mitKonto,
      });
      // Der gewählte Kalender kann verschwunden sein — abgeschaltet oder das
      // Konto getrennt. Dann lieber weitersuchen als gar nichts anbieten.
      if (gewaehlt?.isSynced && gewaehlt.account) return zugangAus(gewaehlt, gewaehlt.account);
    }

    const eigener = await prisma.calendar.findFirst({
      where: { isSynced: true, account: { userId, provider: "icloud" } },
      orderBy: { name: "asc" },
      include: mitKonto,
    });
    if (eigener?.account) return zugangAus(eigener, eigener.account);
  }

  const irgendeiner = await prisma.calendar.findFirst({
    where: { isSynced: true, account: { provider: "icloud" } },
    orderBy: { name: "asc" },
    include: mitKonto,
  });
  return irgendeiner?.account ? zugangAus(irgendeiner, irgendeiner.account) : null;
}

/**
 * Dasselbe, aber für einen Platz statt eine Sitzung.
 *
 * Dafür gibt es den „Kalender von"-Schalter: Wer einen Termin für die andere
 * Person anlegt, will ihn in DEREN Kalender haben. Und der Betreuungsblock
 * („👶 Nicolas · Dirk") gehört dorthin, wo die Betreuung stattfindet — also zu
 * dem, der sie übernimmt.
 */
export async function kalenderzugangFuerPlatz(platz: string): Promise<Kalenderzugang | null> {
  const person = await prisma.user.findFirst({ where: { slot: platz }, select: { id: true } });
  return kalenderzugang(person?.id ?? null);
}

/**
 * Gehört dieses Kalenderkonto zu diesem Haushalt? Heute immer ja — es gibt
 * nur einen. Die Frage steht trotzdem da, weil sie später den Unterschied
 * zwischen „darf löschen" und „darf nicht" ausmacht.
 */
export async function gehoertZumHaushalt(_accountId: string): Promise<boolean> {
  return true;
}
