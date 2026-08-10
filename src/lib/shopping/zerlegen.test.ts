import { describe, it, expect } from "vitest";
import { zerlegeEinkauf, saeubere, MAX_ARTIKEL } from "./zerlegen";

describe("Einkaufstext zerlegen", () => {
  it("trennt bei Kommas", () => {
    expect(zerlegeEinkauf("Tomaten, Käse, Brot")).toEqual(["Tomaten", "Käse", "Brot"]);
  });

  it("trennt bei Zeilen", () => {
    expect(zerlegeEinkauf("Tomaten\nKäse\nBrot")).toEqual(["Tomaten", "Käse", "Brot"]);
  });

  it("nimmt beides gemischt", () => {
    expect(zerlegeEinkauf("Tomaten, Käse\nBrot\n\nMilch")).toEqual([
      "Tomaten",
      "Käse",
      "Brot",
      "Milch",
    ]);
  });

  it("lässt eine Zahl mit Komma in Ruhe", () => {
    // „Milch 1,5 %" ist ein Artikel. Getrennt hieße der zweite „5 %" — und
    // solche Reste stehen wochenlang auf der Liste, weil niemand sie versteht.
    expect(zerlegeEinkauf("Milch 1,5 %, Brot")).toEqual(["Milch 1,5 %", "Brot"]);
  });

  it("wirft Aufzählungszeichen und Häkchen weg", () => {
    expect(zerlegeEinkauf("- Tomaten\n• Käse\n[ ] Brot\n1. Milch\n* Butter")).toEqual([
      "Tomaten",
      "Käse",
      "Brot",
      "Milch",
      "Butter",
    ]);
  });

  it("räumt Leerzeichen auf", () => {
    expect(zerlegeEinkauf("  Tomaten   san marzano  ")).toEqual(["Tomaten san marzano"]);
  });

  it("nimmt dasselbe nur einmal", () => {
    expect(zerlegeEinkauf("Brot, brot, BROT")).toEqual(["Brot"]);
  });

  it("überspringt leere Zeilen und einzelne Trenner", () => {
    expect(zerlegeEinkauf("\n\n, ,\nBrot\n\n")).toEqual(["Brot"]);
    expect(zerlegeEinkauf("")).toEqual([]);
    expect(zerlegeEinkauf("   ")).toEqual([]);
  });

  it("kürzt sehr lange Einträge", () => {
    const lang = "x".repeat(300);
    expect(zerlegeEinkauf(lang)[0]).toHaveLength(120);
  });

  it("behält die Reihenfolge der Eingabe", () => {
    expect(zerlegeEinkauf("Zucker\nApfel\nBrot")).toEqual(["Zucker", "Apfel", "Brot"]);
  });

  it("trennt auch bei Semikolon", () => {
    expect(zerlegeEinkauf("Tomaten; Käse")).toEqual(["Tomaten", "Käse"]);
  });
});

/**
 * Was von einer KI-Antwort übrig bleiben darf. Geprüft wird nicht die KI,
 * sondern die Klammer darum.
 */
describe("KI-Antwort säubern", () => {
  it("nimmt eine gewöhnliche Liste", () => {
    expect(saeubere(["Tomaten", "Käse", "Brot"])).toEqual(["Tomaten", "Käse", "Brot"]);
  });

  it("wirft weg, was keine Zeichenkette ist", () => {
    // Sonst steht irgendwann „[object Object]" auf dem Einkaufszettel.
    expect(saeubere(["Brot", 42, null, { text: "Käse" }, "Milch"])).toEqual(["Brot", "Milch"]);
  });

  it("verträgt alles, was keine Liste ist", () => {
    expect(saeubere(undefined)).toEqual([]);
    expect(saeubere("Brot")).toEqual([]);
    expect(saeubere({ artikel: ["Brot"] })).toEqual([]);
    expect(saeubere(null)).toEqual([]);
  });

  it("räumt Leerzeichen auf und lässt Leeres weg", () => {
    expect(saeubere(["  Brot  ", "", "   ", "Kä  se"])).toEqual(["Brot", "Kä se"]);
  });

  it("nimmt dasselbe nur einmal", () => {
    expect(saeubere(["Brot", "brot", "BROT"])).toEqual(["Brot"]);
  });

  it("hört bei der Obergrenze auf", () => {
    const viele = Array.from({ length: MAX_ARTIKEL + 20 }, (_, i) => `Artikel ${i}`);
    expect(saeubere(viele)).toHaveLength(MAX_ARTIKEL);
  });

  it("kürzt einen überlangen Eintrag", () => {
    expect(saeubere(["y".repeat(400)])[0]).toHaveLength(120);
  });
});
