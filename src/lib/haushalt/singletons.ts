import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/envelope";
import { ICLOUD_PROVIDER, kannSchreiben } from "@/lib/calendar/provider";

/**
 * Die drei Dinge, von denen es „genau eins" gibt.
 *
 * Bisher suchte der Code sie mit `findFirst` — „die Einkaufsliste", „der
 * iCloud-Zugang". Das ist genau die Sorte Abfrage, die bei mehreren
 * Haushalten nicht scheitert, sondern stillschweigend den falschen
 * zurückgibt. Deshalb hat jede dieser Fragen ab jetzt genau eine Stelle,
 * und diese Stelle kennt den Haushalt.
 *
 * Die Suche selbst ist inzwischen wieder unauffällig: Der Riegel in
 * lib/prisma setzt den Haushalt in jede Bedingung ein, `findFirst` findet
 * also nur noch im eigenen Haushalt. Die drei Funktionen bleiben trotzdem —
 * damit die Frage „welche Einkaufsliste?" einen Ort hat und nicht zwölf.
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
 * Schalter des Haushalts.
 *
 * Der Schlüssel trug den Haushalt bis eben als Präfix im Text („1:care.blocks"),
 * weil es keine Spalte dafür gab. Jetzt gibt es eine, und der Riegel setzt sie
 * ein — zwei Wege, dasselbe zu sagen, sind einer zu viel. Der Präfix ist mit
 * Migration 0018 aus den Daten verschwunden.
 */
export async function getHaushaltFlag(key: string, fallback = false): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findFirst({ where: { key } });
    return row ? row.value === "an" : fallback;
  } catch {
    return fallback;
  }
}

export async function setHaushaltFlag(key: string, value: boolean): Promise<void> {
  const v = value ? "an" : "aus";
  const vorhanden = await prisma.appSetting.findFirst({ where: { key }, select: { key: true } });
  if (vorhanden) {
    await prisma.appSetting.updateMany({ where: { key }, data: { value: v } });
  } else {
    await prisma.appSetting.create({ data: { key, value: v } });
  }
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
      /*
       * Der gewählte Kalender kann verschwunden sein — abgeschaltet oder das
       * Konto getrennt. Dann lieber weitersuchen als gar nichts anbieten.
       *
       * Und er kann ein Abonnement sein: Die Frage steht in den Einstellungen
       * neben den anderen, aber hineinschreiben kann man nicht. Ein Termin
       * dorthin wäre beim nächsten Abgleich wieder weg.
       */
      if (gewaehlt?.isSynced && gewaehlt.account && kannSchreiben(gewaehlt.account.provider)) {
        return zugangAus(gewaehlt, gewaehlt.account);
      }
    }

    const eigener = await prisma.calendar.findFirst({
      where: { isSynced: true, account: { userId, provider: ICLOUD_PROVIDER } },
      orderBy: { name: "asc" },
      include: mitKonto,
    });
    if (eigener?.account) return zugangAus(eigener, eigener.account);
  }

  const irgendeiner = await prisma.calendar.findFirst({
    where: { isSynced: true, account: { provider: ICLOUD_PROVIDER } },
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
 * Gehört dieses Kalenderkonto zu diesem Haushalt?
 *
 * Die Antwort war lange „immer ja", weil es nur einen gab. Jetzt fragt sie
 * wirklich nach: Der Riegel filtert die Suche auf den eigenen Haushalt, ein
 * fremdes Konto wird also gar nicht erst gefunden.
 */
export async function gehoertZumHaushalt(accountId: string): Promise<boolean> {
  const treffer = await prisma.calendarAccount.findFirst({
    where: { id: accountId },
    select: { id: true },
  });
  return treffer !== null;
}
