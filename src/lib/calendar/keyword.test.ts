import { describe, it, expect } from "vitest";
import { shortLabel } from "./keyword";

describe("shortLabel", () => {
  it("überspringt Füllwörter und nimmt das prägnante Wort", () => {
    expect(shortLabel("Termin beim Kinderarzt")).toBe("Kinderarzt");
    expect(shortLabel("Besuch von Papa")).toBe("Besuch"); // "Besuch Papa" wäre >10
    expect(shortLabel("Besuch von Papa", 12)).toBe("Besuch Papa");
  });

  it("kombiniert zwei kurze Wörter, wenn sie passen", () => {
    expect(shortLabel("U3 Kinderarzt", 13)).toBe("U3 Kinderarzt");
  });

  it("kürzt hart auf die Maximallänge", () => {
    expect(shortLabel("Elternabendveranstaltung")).toBe("Elternabe…");
    expect(shortLabel("Elternabendveranstaltung").length).toBeLessThanOrEqual(10);
  });

  it("entfernt Emojis und Trenner", () => {
    expect(shortLabel("🎂 Geburtstag – Oma")).toBe("Geburtstag");
  });

  it("bleibt bei Leerem leer", () => {
    expect(shortLabel("")).toBe("");
    expect(shortLabel("🎂")).toBe("");
  });
});
