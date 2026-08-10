import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mitHaushalt } from "@/lib/haushalt/kontext";
import { PLATZ_A, PLATZ_B } from "@/lib/haushalt/platz";

/**
 * Betreuungsblöcke: ein Tag wird als Ganzes gerechnet.
 *
 * iCloud ist hier durch eine Attrappe ersetzt — geprüft wird, WAS geschrieben
 * werden soll, nicht ob das Netz funktioniert. Genau dort saßen die Fehler:
 * zwei Blöcke für eine Zusage, und ein Platz-Wert statt eines Namens.
 */

const geschrieben: { uid: string; titel: string; url: string }[] = [];
const geloescht: string[] = [];

vi.mock("@/lib/calendar/tsdav-client", () => ({
  createICloudClient: async () => ({
    async putEvent(url: string, href: string, ics: string) {
      const uid = /UID:(.+)/.exec(ics)?.[1]?.trim() ?? "";
      const titel = /SUMMARY:(.+)/.exec(ics)?.[1]?.trim() ?? "";
      geschrieben.push({ uid, titel, url });
      return { etag: `etag-${geschrieben.length}` };
    },
    async deleteEvent(href: string) {
      geloescht.push(href);
    },
  }),
}));

const prisma = new PrismaClient();

// Alle Prüfungen laufen im selben Haushalt; die Trennung prüft mandanten.test.ts.
const HAUSHALT = "h-test";
const imHaushalt = <T>(fn: () => Promise<T>) => mitHaushalt(HAUSHALT, fn);
const TAG = new Date("2026-08-10T00:00:00.000Z");

let dirk = "", conny = "", kalender = "";

function ics(uid: string, titel: string, vonH: number, bisH: number) {
  const t = (h: number) => `20260810T${String(h).padStart(2, "0")}0000Z`;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
    `UID:${uid}`, `SUMMARY:${titel}`,
    `DTSTART:${t(vonH)}`, `DTEND:${t(bisH)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

async function frisch() {
  geschrieben.length = 0;
  geloescht.length = 0;
  await prisma.careAssignment.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.calendar.deleteMany({});
  await prisma.calendarAccount.deleteMany({});
  await prisma.appSetting.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "households" CASCADE');
  await prisma.household.create({ data: { id: HAUSHALT, name: "Prüfung" } });

  const { encryptSecret } = await import("@/lib/crypto/envelope");
  dirk = (await prisma.user.create({ data: { householdId: HAUSHALT, email: "d@x.de", name: "Dirk", slot: PLATZ_A } })).id;
  conny = (await prisma.user.create({ data: { householdId: HAUSHALT, email: "c@x.de", name: "Conny", slot: PLATZ_B } })).id;
  const acc = await prisma.calendarAccount.create({
    data: { householdId: HAUSHALT, userId: dirk, provider: "icloud", username: "d@icloud.com", credentialsEncrypted: encryptSecret("pw") },
  });
  kalender = (await prisma.calendar.create({ data: { householdId: HAUSHALT, accountId: acc.id, name: "Familie", url: "https://x/fam/" } })).id;
  await prisma.appSetting.create({ data: { householdId: HAUSHALT, key: "care.blocks", value: "an" } });
}

async function termin(uid: string, titel: string, vonH: number, bisH: number) {
  await prisma.event.create({
    data: {
      householdId: HAUSHALT, calendarId: kalender, uid, recurrenceId: "", href: `https://x/fam/${uid}.ics`,
      title: titel, start: new Date(`2026-08-10T${String(vonH).padStart(2, "0")}:00:00Z`),
      end: new Date(`2026-08-10T${String(bisH).padStart(2, "0")}:00:00Z`),
      allDay: false, rawIcs: ics(uid, titel, vonH, bisH),
    },
  });
}

async function betreuung(eventUid: string, userId: string | null, note?: string) {
  await prisma.careAssignment.create({
    data: {
      householdId: HAUSHALT, eventUid, occurrenceDate: TAG,
      responsibleUserId: userId,
      status: userId ? "geklaert" : "extern",
      note: note ?? null,
    },
  });
}

describe("Betreuungsblöcke für einen Tag", () => {
  beforeEach(frisch);
  afterAll(() => prisma.$disconnect());

  it("macht aus zwei überlappenden Terminen einen Block", async () => {
    // Genau der Fall aus dem Kalender: zwei Termine um 11:35.
    await termin("a", "Bestätigung", 11, 12);
    await termin("b", "Ausweisdokumente", 11, 12);
    await betreuung("a", conny);
    await betreuung("b", conny);

    const { synchronisiereTag } = await import("@/lib/care/block-sync");
    await imHaushalt(() => synchronisiereTag(TAG));

    expect(geschrieben).toHaveLength(1);
    expect(geschrieben[0].titel).toBe("👶 das Baby · Conny");
  });

  it("schreibt den Namen, nicht den Platz-Wert", async () => {
    await termin("a", "Zahnarzt", 9, 10);
    await betreuung("a", dirk);
    const { synchronisiereTag } = await import("@/lib/care/block-sync");
    await imHaushalt(() => synchronisiereTag(TAG));
    expect(geschrieben[0].titel).toBe("👶 das Baby · Dirk");
    expect(geschrieben[0].titel).not.toContain("dirk");
  });

  it("trennt zwei Personen und zwei Tageszeiten", async () => {
    await termin("a", "Vormittag", 9, 11);
    await termin("b", "Abend", 18, 20);
    await termin("c", "Auch vormittags", 10, 11);
    await betreuung("a", conny);
    await betreuung("c", conny);
    await betreuung("b", dirk);

    const { synchronisiereTag } = await import("@/lib/care/block-sync");
    await imHaushalt(() => synchronisiereTag(TAG));

    expect(geschrieben).toHaveLength(2);
    expect(geschrieben.map((g) => g.titel).sort()).toEqual([
      "👶 das Baby · Conny",
      "👶 das Baby · Dirk",
    ]);
  });

  it("hält Oma und den Babysitter auseinander", async () => {
    await termin("a", "Kino", 19, 22);
    await termin("b", "Essen", 19, 21);
    await betreuung("a", null, "Oma");
    await betreuung("b", null, "Babysitter");

    const { synchronisiereTag } = await import("@/lib/care/block-sync");
    await imHaushalt(() => synchronisiereTag(TAG));
    expect(geschrieben).toHaveLength(2);
  });

  it("schreibt beim zweiten Lauf nichts noch einmal", async () => {
    await termin("a", "Zahnarzt", 9, 10);
    await betreuung("a", dirk);
    const { synchronisiereTag } = await import("@/lib/care/block-sync");
    await imHaushalt(() => synchronisiereTag(TAG));
    const nachErstem = geschrieben.length;
    // Über eine Sekundengrenze hinweg: Im .ics steht ein Zeitstempel, der sich
    // jede Sekunde ändert. Ohne die Klammer in ics-builder verglich der Lauf
    // zwei Texte, die sich immer unterscheiden — und schrieb jedes Mal neu
    // nach iCloud. Die Prüfung merkte davon nichts, weil beide Läufe in
    // dieselbe Sekunde fielen.
    await new Promise((r) => setTimeout(r, 1100));
    await imHaushalt(() => synchronisiereTag(TAG));
    expect(geschrieben.length).toBe(nachErstem);
  });

  it("räumt den Block weg, wenn die Zusage zurückgenommen wird", async () => {
    await termin("a", "Zahnarzt", 9, 10);
    await betreuung("a", dirk);
    const { synchronisiereTag } = await import("@/lib/care/block-sync");
    await imHaushalt(() => synchronisiereTag(TAG));
    expect(await prisma.event.count({ where: { uid: { startsWith: "fp-care-" } } })).toBe(1);

    await prisma.careAssignment.updateMany({ where: { eventUid: "a" }, data: { status: "offen", responsibleUserId: null } });
    await imHaushalt(() => synchronisiereTag(TAG));
    expect(await prisma.event.count({ where: { uid: { startsWith: "fp-care-" } } })).toBe(0);
  });

  it("räumt einen Block aus der alten Zeit mit weg", async () => {
    // So sahen UIDs aus, als jeder Termin seinen eigenen Block hatte.
    await termin("a", "Zahnarzt", 9, 10);
    await betreuung("a", dirk);
    const altUid = "fp-care-2026-08-10-a@planyourweek.app";
    await prisma.event.create({
      data: {
        householdId: HAUSHALT, calendarId: kalender, uid: altUid, recurrenceId: "", href: `https://x/fam/${altUid}.ics`,
        title: "👶 Nicolas · dirk", start: new Date("2026-08-10T09:00:00Z"),
        end: new Date("2026-08-10T10:00:00Z"), allDay: false, rawIcs: ics(altUid, "alt", 9, 10),
      },
    });

    const { synchronisiereTag } = await import("@/lib/care/block-sync");
    await imHaushalt(() => synchronisiereTag(TAG));

    const uebrig = await prisma.event.findMany({
      where: { uid: { startsWith: "fp-care-" } }, select: { uid: true, title: true },
    });
    expect(uebrig).toHaveLength(1);
    expect(uebrig[0].title).toBe("👶 das Baby · Dirk");
  });

  it("schreibt die Zuordnung aus, damit der Block seine Anlässe kennt", async () => {
    await termin("a", "Bestätigung", 11, 12);
    await termin("b", "Ausweisdokumente", 11, 12);
    await betreuung("a", conny);
    await betreuung("b", conny);

    const { synchronisiereTag, anlassFuerBlock } = await import("@/lib/care/block-sync");
    await imHaushalt(() => synchronisiereTag(TAG));

    const uid = (await prisma.careAssignment.findFirst({ where: { eventUid: "a" } }))!.blockUid!;
    expect(uid).toBeTruthy();
    const anlass = await imHaushalt(() => anlassFuerBlock(uid));
    expect(anlass?.anlaesse.sort()).toEqual(["Ausweisdokumente", "Bestätigung"]);
    expect(anlass?.responsibleUserId).toBe(conny);
  });

  it("rechnet nur die Tage neu, an denen etwas abgesprochen ist", async () => {
    // Der Anlass: Jemand ändert seinen Namen. Im Blocktitel steht er mit
    // drin, also müssen die Blöcke neu geschrieben werden — aber eben nur
    // die, die es gibt, nicht hundertzwölf Tage am Stück.
    const { schreibeBetroffeneBloeckeNeu } = await import("@/lib/care/block-sync");
    const jetzt = new Date("2026-08-10T10:00:00.000Z");

    await termin("a", "Zahnarzt", 9, 10);
    await betreuung("a", dirk);
    // Zweiter Tag, damit sich „ein Tag" nicht zufällig richtig anfühlt.
    await prisma.careAssignment.create({
      data: {
        householdId: HAUSHALT, eventUid: "b", occurrenceDate: new Date("2026-08-12T00:00:00.000Z"),
        responsibleUserId: conny, status: "geklaert",
      },
    });
    // Weit außerhalb des Zeitraums — was ein halbes Jahr her ist, liest
    // niemand mehr nach.
    await prisma.careAssignment.create({
      data: {
        householdId: HAUSHALT, eventUid: "c", occurrenceDate: new Date("2026-01-05T00:00:00.000Z"),
        responsibleUserId: dirk, status: "geklaert",
      },
    });

    const r = await imHaushalt(() => schreibeBetroffeneBloeckeNeu(jetzt));
    expect(r.tage).toBe(2);
  });

  it("fasst zwei Absprachen am selben Tag zu einem Lauf zusammen", async () => {
    const { schreibeBetroffeneBloeckeNeu } = await import("@/lib/care/block-sync");
    await termin("a", "Bestätigung", 11, 12);
    await termin("b", "Ausweisdokumente", 11, 12);
    await betreuung("a", conny);
    await betreuung("b", conny);

    const r = await imHaushalt(() => schreibeBetroffeneBloeckeNeu(TAG));
    expect(r.tage).toBe(1);
  });
});
