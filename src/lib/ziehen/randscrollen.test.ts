import { describe, it, expect } from "vitest";
import { schrittFuer } from "./randscrollen";

/**
 * Der Rand ist die einzige Stelle, an der etwas passieren darf. In der Mitte
 * zu schieben, während jemand eine Aufgabe über eine Liste hält, wäre schlimmer
 * als gar nicht zu schieben.
 */
describe("Mitscrollen am Rand", () => {
  const OBEN = 0;
  const UNTEN = 800;

  it("lässt die Mitte in Ruhe", () => {
    expect(schrittFuer(400, OBEN, UNTEN)).toBe(0);
    expect(schrittFuer(200, OBEN, UNTEN)).toBe(0);
    expect(schrittFuer(600, OBEN, UNTEN)).toBe(0);
  });

  it("schiebt nach oben, wenn der Finger oben ist", () => {
    expect(schrittFuer(40, OBEN, UNTEN)).toBeLessThan(0);
    expect(schrittFuer(0, OBEN, UNTEN)).toBeLessThan(0);
  });

  it("schiebt nach unten, wenn der Finger unten ist", () => {
    expect(schrittFuer(770, OBEN, UNTEN)).toBeGreaterThan(0);
    expect(schrittFuer(800, OBEN, UNTEN)).toBeGreaterThan(0);
  });

  it("wird schneller, je näher am Rand", () => {
    // Sonst müsste man den Finger exakt platzieren, um langsam zu scrollen —
    // mit einem Daumen und einem Kind auf dem Arm keine Bedienung.
    const knappDrin = Math.abs(schrittFuer(80, OBEN, UNTEN));
    const ganzAmRand = Math.abs(schrittFuer(2, OBEN, UNTEN));
    expect(ganzAmRand).toBeGreaterThan(knappDrin);
  });

  it("hört auch außerhalb des Randes nicht auf zu wirken", () => {
    // Der Finger kann über den Rand hinausgezogen werden — dann bleibt es beim
    // Höchsttempo, statt in die Ruhe zurückzufallen.
    expect(schrittFuer(-50, OBEN, UNTEN)).toBe(schrittFuer(0, OBEN, UNTEN));
    expect(schrittFuer(900, OBEN, UNTEN)).toBe(schrittFuer(800, OBEN, UNTEN));
  });

  it("tut nichts, wenn der Bereich zu flach für zwei Zonen ist", () => {
    // Sonst überlappten sich obere und untere Zone und der Inhalt zuckte.
    expect(schrittFuer(50, 0, 120)).toBe(0);
  });
});
