import { describe, it, expect } from "vitest";
import { normalizePrep } from "./prep-suggest";

describe("normalizePrep", () => {
  it("liefert bei Müll eine leere Liste", () => {
    expect(normalizePrep(null)).toEqual([]);
    expect(normalizePrep({ items: "nope" })).toEqual([]);
  });

  it("trimmt, filtert leere und dedupliziert (case-insensitiv)", () => {
    const out = normalizePrep({ items: ["  Wickeltasche ", "wickeltasche", "", "Wechselkleidung"] });
    expect(out).toEqual(["Wickeltasche", "Wechselkleidung"]);
  });

  it("begrenzt auf 8", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Punkt ${i}`);
    expect(normalizePrep({ items: many })).toHaveLength(8);
  });
});
