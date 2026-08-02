import { describe, it, expect } from "vitest";
import { groupKeyFor, storeIdFromGroupKey, OHNE_LADEN } from "./stores";

describe("Gruppen-Kennung der Läden", () => {
  it("bildet fehlenden Laden auf das Fach Sonstiges ab", () => {
    expect(groupKeyFor(null)).toBe(OHNE_LADEN);
    expect(groupKeyFor(undefined)).toBe(OHNE_LADEN);
  });

  it("lässt eine echte Laden-Id unangetastet", () => {
    expect(groupKeyFor("str_abc")).toBe("str_abc");
  });

  it("hin und zurück ergibt dasselbe", () => {
    // Sonst landen Artikel beim Verschieben im falschen Fach.
    expect(storeIdFromGroupKey(groupKeyFor("str_abc"))).toBe("str_abc");
    expect(storeIdFromGroupKey(groupKeyFor(null))).toBe(null);
  });
});
