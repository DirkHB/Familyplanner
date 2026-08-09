import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mitHaushalt } from "@/lib/haushalt/kontext";
import {
  uebernehmeBetreuung,
  frageDenAnderen,
  ziehFrageZurueck,
} from "@/lib/care/entscheidung";
import { answerRequest } from "@/lib/requests/repository";
import { PLATZ_A, PLATZ_B } from "@/lib/haushalt/platz";

const prisma = new PrismaClient();

// Alle Prüfungen laufen im selben Haushalt; die Trennung prüft mandanten.test.ts.
const HAUSHALT = "h-test";
const imHaushalt = <T>(fn: () => Promise<T>) => mitHaushalt(HAUSHALT, fn);
const ISO_12 = "2026-08-12T10:00:00.000Z";
const ISO_19 = "2026-08-19T10:00:00.000Z";
const UID = "serie-physio";

let dirk = "", conny = "";

async function frisch() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "households" CASCADE');
  await prisma.household.create({ data: { id: HAUSHALT, name: "Prüfung" } });
  await prisma.request.deleteMany({});
  await prisma.careAssignment.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.calendar.deleteMany({});
  await prisma.calendarAccount.deleteMany({});
  await prisma.user.deleteMany({});
  dirk = (await prisma.user.create({ data: { householdId: HAUSHALT, email: "d@x.de", name: "Dirk", slot: PLATZ_A } })).id;
  conny = (await prisma.user.create({ data: { householdId: HAUSHALT, email: "c@x.de", name: "Conny", slot: PLATZ_B } })).id;
}

const offeneAnfragen = () =>
  prisma.request.findMany({ where: { status: "open" }, orderBy: { createdAt: "asc" } });

describe("Betreuungsfrage", () => {
  beforeEach(frisch);
  afterAll(() => prisma.$disconnect());

  it("fragt genau einmal, egal wie oft man tippt", async () => {
    for (let i = 0; i < 4; i++) await imHaushalt(() => frageDenAnderen(UID, ISO_12, dirk, "Physio"));
    expect((await offeneAnfragen()).length).toBe(1);
  });

  it("meldet beim zweiten Mal, dass die Frage schon läuft", async () => {
    await imHaushalt(() => frageDenAnderen(UID, ISO_12, dirk, "Physio"));
    const zweitens = await imHaushalt(() => frageDenAnderen(UID, ISO_12, dirk, "Physio"));
    expect(zweitens.art).toBe("lief-schon");
  });

  it("trifft bei einer Serie das Vorkommen, nach dem gefragt wurde", async () => {
    // Beide Dienstage offen; gefragt wird nach dem 19.
    await imHaushalt(() => frageDenAnderen(UID, ISO_12, dirk, "Physio"));
    const spaeter = await imHaushalt(() => frageDenAnderen(UID, ISO_19, dirk, "Physio"));
    if (spaeter.art !== "gefragt") throw new Error(`erwartet: gefragt, war: ${spaeter.art}`);

    await imHaushalt(() => answerRequest(spaeter.requestId!, conny, "Ja"));

    const rows = await prisma.careAssignment.findMany({ orderBy: { occurrenceDate: "asc" } });
    expect(rows.map((r) => [r.occurrenceDate.toISOString().slice(0, 10), r.status])).toEqual([
      ["2026-08-12", "offen"],
      ["2026-08-19", "geklaert"],
    ]);
  });

  it("nimmt die eigene Frage weg, wenn ich es doch selbst mache", async () => {
    await imHaushalt(() => frageDenAnderen(UID, ISO_12, dirk, "Physio"));
    const r = await imHaushalt(() => uebernehmeBetreuung(UID, ISO_12, dirk));
    expect(r.art).toBe("uebernommen");
    expect(await offeneAnfragen()).toHaveLength(0);
    const care = await prisma.careAssignment.findFirst();
    expect([care?.status, care?.responsibleUserId]).toEqual(["geklaert", dirk]);
  });

  it('wertet die eigene Zusage als Ja, wenn der andere mich gefragt hat', async () => {
    await imHaushalt(() => frageDenAnderen(UID, ISO_12, dirk, "Physio"));
    const r = await imHaushalt(() => uebernehmeBetreuung(UID, ISO_12, conny));
    expect(r.art).toBe("antwort");
    const req = await prisma.request.findFirst();
    expect([req?.status, req?.answer]).toEqual(["answered", "Ja"]);
    const care = await prisma.careAssignment.findFirst();
    expect([care?.status, care?.responsibleUserId]).toEqual(["geklaert", conny]);
  });

  it("überschreibt eine frische Zusage des anderen nicht", async () => {
    await imHaushalt(() => uebernehmeBetreuung(UID, ISO_12, conny));
    const r = await imHaushalt(() => uebernehmeBetreuung(UID, ISO_12, dirk));
    expect(r.art).toBe("schon");
    const care = await prisma.careAssignment.findFirst();
    expect(care?.responsibleUserId).toBe(conny);
  });

  it("lässt nach einem Nein wieder fragen", async () => {
    const erste = await imHaushalt(() => frageDenAnderen(UID, ISO_12, dirk, "Physio"));
    if (erste.art !== "gefragt") throw new Error(`erwartet: gefragt, war: ${erste.art}`);
    await imHaushalt(() => answerRequest(erste.requestId!, conny, "Nein"));
    const zweite = await imHaushalt(() => frageDenAnderen(UID, ISO_12, dirk, "Physio"));
    expect(zweite.art).toBe("gefragt");
    expect(await offeneAnfragen()).toHaveLength(1);
  });

  it("zieht die eigene Frage zurück, ohne sie zu beantworten", async () => {
    await imHaushalt(() => frageDenAnderen(UID, ISO_12, dirk, "Physio"));
    await imHaushalt(() => ziehFrageZurueck(UID, ISO_12, dirk));
    expect(await prisma.request.count()).toBe(0);
  });
});
