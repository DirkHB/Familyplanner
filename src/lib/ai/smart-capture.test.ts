import { describe, it, expect } from "vitest";
import { normalizeSmart } from "./smart-capture";

describe("normalizeSmart", () => {
  it("liefert bei Müll eine leere Liste", () => {
    expect(normalizeSmart(null).items).toEqual([]);
    expect(normalizeSmart({ items: "nein" }).items).toEqual([]);
  });

  it("übernimmt gültige Items und filtert titellose", () => {
    const r = normalizeSmart({
      items: [
        { kind: "termin", title: "Kinderarzt", start: "2026-08-03T10:00:00+02:00", allDay: false },
        { kind: "einkauf", title: "Windeln", store: "edeka" },
        { title: "" },
      ],
    });
    expect(r.items).toHaveLength(2);
    expect(r.items[0].kind).toBe("termin");
    expect(r.items[1].store).toBe("edeka");
  });

  it("fällt bei unbekannter Art auf 'aufgabe' zurück und säubert Felder", () => {
    const r = normalizeSmart({
      items: [{ kind: "quatsch", title: "Kita anrufen", assignee: "wer", store: "aldi", dueDate: "morgen", category: "xx" }],
    });
    expect(r.items[0]).toMatchObject({
      kind: "aufgabe",
      assignee: "",
      store: "sonstiges",
      dueDate: "",
      category: "sonstiges",
    });
  });

  it("begrenzt auf 8 Items", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ kind: "aufgabe", title: `A${i}` }));
    expect(normalizeSmart({ items: many }).items).toHaveLength(8);
  });
});
