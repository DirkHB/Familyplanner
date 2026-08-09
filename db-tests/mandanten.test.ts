import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mitHaushalt, ueberAlleHaushalte } from "@/lib/haushalt/kontext";

/**
 * Der Riegel: Zwei Haushalte in einer Datenbank sehen einander nicht.
 *
 * Das ist die Prüfung, für die diese ganze Etappe da ist. Ein vergessenes
 * `where: { householdId }` wirft keine Ausnahme — es zeigt still die Termine
 * einer anderen Familie. Deshalb wird hier absichtlich OHNE Filter abgefragt:
 * Genau so, wie es die rund zweihundert Stellen in der App tun.
 */

const roh = new PrismaClient();

beforeAll(async () => {
  await roh.$executeRawUnsafe('TRUNCATE TABLE "households" CASCADE');
  await roh.household.createMany({
    data: [
      { id: "h-a", name: "Familie A" },
      { id: "h-b", name: "Familie B" },
    ],
  });
  await roh.todo.createMany({
    data: [
      { id: "a1", householdId: "h-a", title: "Windeln kaufen", status: "offen" },
      { id: "a2", householdId: "h-a", title: "Kita anrufen", status: "offen" },
      { id: "b1", householdId: "h-b", title: "Geheim von B", status: "offen" },
    ],
  });
  await roh.store.createMany({
    data: [
      { id: "sa", householdId: "h-a", name: "Kaefer" },
      { id: "sb", householdId: "h-b", name: "Aldi" },
    ],
  });
});

afterAll(() => roh.$disconnect());

describe("Zwei Haushalte in einer Datenbank", () => {
  it("zeigt einer Familie nur ihre eigenen Aufgaben — ohne dass die Abfrage filtert", async () => {
    const a = await mitHaushalt("h-a", () => prisma.todo.findMany({}));
    const b = await mitHaushalt("h-b", () => prisma.todo.findMany({}));
    expect(a.map((t) => t.title).sort()).toEqual(["Kita anrufen", "Windeln kaufen"]);
    expect(b.map((t) => t.title)).toEqual(["Geheim von B"]);
  });

  it("zählt nur die eigenen", async () => {
    expect(await mitHaushalt("h-a", () => prisma.todo.count())).toBe(2);
    expect(await mitHaushalt("h-b", () => prisma.todo.count())).toBe(1);
  });

  it("gibt eine fremde Zeile auch bei gezielter Suche nicht heraus", async () => {
    // Die Kennung der fremden Zeile zu kennen, reicht nicht.
    const treffer = await mitHaushalt("h-a", () => prisma.todo.findUnique({ where: { id: "b1" } }));
    expect(treffer).toBeNull();
  });

  it("lässt eine fremde Zeile nicht ändern", async () => {
    await expect(
      mitHaushalt("h-a", () => prisma.todo.update({ where: { id: "b1" }, data: { title: "gekapert" } })),
    ).rejects.toThrow();
    const b1 = await roh.todo.findUnique({ where: { id: "b1" } });
    expect(b1?.title).toBe("Geheim von B");
  });

  it("löscht nicht über Haushalte hinweg", async () => {
    await mitHaushalt("h-a", () => prisma.todo.deleteMany({ where: { status: "offen" } }));
    expect(await roh.todo.count({ where: { householdId: "h-b" } })).toBe(1);
    // Für den Rest der Prüfungen wiederherstellen.
    await roh.todo.createMany({
      data: [
        { id: "a1", householdId: "h-a", title: "Windeln kaufen", status: "offen" },
        { id: "a2", householdId: "h-a", title: "Kita anrufen", status: "offen" },
      ],
    });
  });

  it("schreibt neue Zeilen in den eigenen Haushalt, ohne dass die Abfrage es sagt", async () => {
    await mitHaushalt("h-b", () =>
      prisma.todo.create({ data: { title: "Neu bei B", status: "offen" } }),
    );
    const neu = await roh.todo.findFirst({ where: { title: "Neu bei B" } });
    expect(neu?.householdId).toBe("h-b");
  });

  it("bricht ohne Haushalt ab, statt alles zu zeigen", async () => {
    // Kein Kontext, keine Sitzung — das ist der gefährliche Fall.
    await expect(prisma.todo.findMany({})).rejects.toThrow(/Kein Haushalt/);
  });

  it("lässt den Blick über alle Haushalte nur zu, wenn man es hinschreibt", async () => {
    const alle = await ueberAlleHaushalte(() => prisma.todo.findMany({}));
    expect(alle.length).toBeGreaterThan(2);
  });

  it("verliert einen eigenen Filter nicht", async () => {
    const offen = await mitHaushalt("h-a", () =>
      prisma.todo.findMany({ where: { title: { contains: "Windeln" } } }),
    );
    expect(offen).toHaveLength(1);
  });

  it("räumt beim Löschen eines Haushalts alles mit weg", async () => {
    await roh.household.delete({ where: { id: "h-b" } });
    expect(await roh.todo.count({ where: { householdId: "h-b" } })).toBe(0);
    expect(await roh.store.count({ where: { householdId: "h-b" } })).toBe(0);
  });
});
