import { describe, it, expect } from "vitest";
import { normalizeWeeklyPlan } from "./weekly-plan";

describe("normalizeWeeklyPlan", () => {
  it("liefert bei Müll ein leeres, gültiges Objekt", () => {
    const p = normalizeWeeklyPlan(null);
    expect(p.summary).toBe("");
    expect(p.suggestions).toEqual([]);
  });

  it("übernimmt gültige Vorschläge und filtert leere", () => {
    const p = normalizeWeeklyPlan({
      summary: "Ruhige Woche.",
      suggestions: [
        { kind: "betreuung", text: "Kläre Betreuung für den Kinderarzt am Montag." },
        { kind: "vorbereitung", text: "" },
        { text: "Ohne kind-Feld" },
      ],
    });
    expect(p.summary).toBe("Ruhige Woche.");
    expect(p.suggestions).toHaveLength(2);
    expect(p.suggestions[1].kind).toBe("sonstiges");
  });

  it("mappt unbekannte kind auf sonstiges und begrenzt auf 8", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ kind: "xxx", text: `V${i}` }));
    const p = normalizeWeeklyPlan({ summary: "x", suggestions: many });
    expect(p.suggestions).toHaveLength(8);
    expect(p.suggestions.every((s) => s.kind === "sonstiges")).toBe(true);
  });
});
