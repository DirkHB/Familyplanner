import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  ladeEin,
  pruefeToken,
  offeneEinladung,
  darfSichAnmelden,
  loeseEin,
  offeneEinladungenDesHaushalts,
} from "@/lib/einladung/store";
import { laeuftAb } from "@/lib/einladung/token";

/**
 * Einladungen sind der einzige Weg in die App. Deshalb wird hier nicht
 * geprüft, ob sie funktionieren, sondern ob sie in den Fällen NICHT
 * funktionieren, in denen sie es nicht sollen: zweimal eingelöst, abgelaufen,
 * von der falschen Adresse.
 */

const prisma = new PrismaClient();

async function frisch() {
  await prisma.invite.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "households" CASCADE');
}

describe("Einladungen", () => {
  beforeEach(frisch);
  afterAll(() => prisma.$disconnect());

  it("legt beim Einlösen einen neuen Haushalt an", async () => {
    const { token } = await ladeEin({ email: "Thomas@Example.com" });
    const gueltig = await pruefeToken(token);
    expect(gueltig.art).toBe("gueltig");

    const vorher = await prisma.household.count();
    const eingeloest = await loeseEin("thomas@example.com");
    expect(eingeloest?.neuerHaushalt).toBe(true);
    expect(await prisma.household.count()).toBe(vorher + 1);
  });

  it("nimmt den genannten Haushalt, statt einen neuen anzulegen", async () => {
    const haus = await prisma.household.create({ data: { name: "Erster" } });
    const { token } = await ladeEin({ email: "yvonne@example.com", householdId: haus.id });
    expect((await pruefeToken(token)).art).toBe("gueltig");

    const eingeloest = await loeseEin("yvonne@example.com");
    expect(eingeloest).toEqual({ householdId: haus.id, neuerHaushalt: false });
    expect(await prisma.household.count()).toBe(1);
  });

  it("funktioniert genau einmal", async () => {
    const { token } = await ladeEin({ email: "thomas@example.com" });
    expect(await loeseEin("thomas@example.com")).not.toBe(null);
    // Der zweite Versuch geht ins Leere — und legt vor allem keinen zweiten
    // Haushalt an. Genau das wäre der teure Fehler.
    const zweiter = await loeseEin("thomas@example.com");
    expect(zweiter).toBe(null);
    expect(await prisma.household.count()).toBe(1);
    expect((await pruefeToken(token)).art).toBe("verbraucht");
  });

  it("gilt nur für die Adresse, an die sie ging", async () => {
    await ladeEin({ email: "thomas@example.com" });
    expect(await loeseEin("jemand.anderes@example.com")).toBe(null);
    expect(await darfSichAnmelden("jemand.anderes@example.com")).toBe(false);
    expect(await darfSichAnmelden("thomas@example.com")).toBe(true);
  });

  it("läuft ab", async () => {
    const laengstVorbei = new Date(Date.now() - 30 * 86_400_000);
    const { token } = await ladeEin({ email: "thomas@example.com", jetzt: laengstVorbei });
    expect((await pruefeToken(token)).art).toBe("abgelaufen");
    expect(await offeneEinladung("thomas@example.com")).toBe(null);
    expect(await darfSichAnmelden("thomas@example.com")).toBe(false);
    expect(await loeseEin("thomas@example.com")).toBe(null);
  });

  it("kennt einen erfundenen Token nicht", async () => {
    expect((await pruefeToken("gibtesnicht")).art).toBe("unbekannt");
    expect((await pruefeToken("")).art).toBe("unbekannt");
  });

  it("ersetzt eine ältere offene Einladung an dieselbe Adresse", async () => {
    const alt = await ladeEin({ email: "thomas@example.com" });
    const neu = await ladeEin({ email: "thomas@example.com" });
    // Zwei gültige Links für einen Menschen wären eine Einladung, deren
    // Wirkung davon abhängt, welchen er zuerst antippt.
    expect((await pruefeToken(alt.token)).art).toBe("unbekannt");
    expect((await pruefeToken(neu.token)).art).toBe("gueltig");
    expect(await prisma.invite.count({ where: { email: "thomas@example.com" } })).toBe(1);
  });

  it("lässt herein, wer schon hier wohnt — auch ohne Einladung", async () => {
    const haus = await prisma.household.create({ data: {} });
    await prisma.user.create({
      data: { householdId: haus.id, email: "dirk@example.com", name: "Dirk" },
    });
    expect(await darfSichAnmelden("dirk@example.com")).toBe(true);
    expect(await darfSichAnmelden("DIRK@example.com")).toBe(true);
  });

  it("lässt niemanden ohne beides herein", async () => {
    expect(await darfSichAnmelden("fremd@example.com")).toBe(false);
    expect(await darfSichAnmelden("")).toBe(false);
    expect(await darfSichAnmelden(null)).toBe(false);
  });

  it("zeigt einem Haushalt nur seine eigenen offenen Einladungen", async () => {
    const a = await prisma.household.create({ data: { name: "A" } });
    const b = await prisma.household.create({ data: { name: "B" } });
    await ladeEin({ email: "eins@example.com", householdId: a.id });
    await ladeEin({ email: "zwei@example.com", householdId: b.id });
    await ladeEin({ email: "drei@example.com" });

    const offenA = await offeneEinladungenDesHaushalts(a.id);
    expect(offenA.map((e) => e.email)).toEqual(["eins@example.com"]);
  });

  it("legt die Adresse klein ab, egal wie sie getippt wurde", async () => {
    await ladeEin({ email: "  Thomas@Example.COM " });
    const zeile = await prisma.invite.findFirst({});
    expect(zeile?.email).toBe("thomas@example.com");
    expect(zeile?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(zeile?.expiresAt.getTime()).toBeLessThanOrEqual(laeuftAb().getTime() + 1000);
  });
});
