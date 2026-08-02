import { describe, it, expect } from "vitest";
import { parsePastedTasks, MAX_ZEILEN } from "./paste";

describe("parsePastedTasks", () => {
  it("eine Zeile, eine Aufgabe", () => {
    expect(parsePastedTasks("Windeln bestellen\nKindergeld beantragen")).toEqual([
      "Windeln bestellen",
      "Kindergeld beantragen",
    ]);
  });

  it("überspringt Leerzeilen und räumt Leerraum auf", () => {
    expect(parsePastedTasks("  Milch   kaufen  \n\n\n  Brot  ")).toEqual([
      "Milch kaufen",
      "Brot",
    ]);
  });

  it("schält Aufzählungszeichen ab", () => {
    expect(
      parsePastedTasks("- Windeln\n• Brei\n* Schnuller\n– Fläschchen\n> Tücher"),
    ).toEqual(["Windeln", "Brei", "Schnuller", "Fläschchen", "Tücher"]);
  });

  it("schält Nummerierungen ab", () => {
    expect(parsePastedTasks("1. Erstes\n2) Zweites\n12. Zwölftes")).toEqual([
      "Erstes",
      "Zweites",
      "Zwölftes",
    ]);
  });

  it("schält Checkbox-Reste ab, auch verschachtelt", () => {
    // Markdown-Export: „- [ ] Aufgabe" — zwei Präfixe hintereinander.
    expect(parsePastedTasks("- [ ] Offen\n- [x] Angehakt\n☐ Kästchen")).toEqual([
      "Offen",
      "Angehakt",
      "Kästchen",
    ]);
  });

  it("lässt Titel in Ruhe, die nur so ähnlich aussehen", () => {
    // Ein Datum oder eine Zahl MITTEN im Titel ist kein Präfix.
    expect(parsePastedTasks("Termin 3. August bestätigen")).toEqual([
      "Termin 3. August bestätigen",
    ]);
  });

  it("wirft reine Zeichenreste weg", () => {
    expect(parsePastedTasks("---\n***\nEchte Aufgabe")).toEqual(["Echte Aufgabe"]);
  });

  it("nimmt Doppeltes nur einmal", () => {
    expect(parsePastedTasks("Milch\nmilch\nMILCH\nBrot")).toEqual(["Milch", "Brot"]);
  });

  it("hält die Obergrenze ein", () => {
    const viele = Array.from({ length: MAX_ZEILEN + 50 }, (_, i) => `Aufgabe ${i}`).join("\n");
    expect(parsePastedTasks(viele)).toHaveLength(MAX_ZEILEN);
  });
});
