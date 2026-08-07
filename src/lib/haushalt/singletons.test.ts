import { describe, it, expect } from "vitest";
import { haushaltId, EIN_HAUSHALT } from "./id";

/**
 * Die Kennung selbst ist trivial — geprüft wird, dass sie stabil ist. An ihr
 * hängen Cache-Schlüssel und zwei Eindeutigkeiten in der Datenbank; ändert
 * sie sich unbemerkt, verliert der Haushalt seine Schalter und sein Briefing.
 */
describe("haushaltId", () => {
  it("ist stabil über Aufrufe hinweg", () => {
    expect(haushaltId()).toBe(haushaltId());
    expect(haushaltId()).toBe(EIN_HAUSHALT);
  });

  it("stimmt mit der Vorgabe in der Migration überein", () => {
    // Migration 0012 setzt DEFAULT '1' auf care_rules und briefings.
    expect(EIN_HAUSHALT).toBe("1");
  });
});
