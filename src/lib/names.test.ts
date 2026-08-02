import { describe, it, expect } from "vitest";
import { normalizeName, nameVergeben, MAX_NAME_LAENGE } from "./names";

describe("normalizeName", () => {
  it("nimmt Leerraum an den Rändern weg", () => {
    expect(normalizeName("  Lidl  ")).toBe("Lidl");
  });

  it("zieht mehrfachen Leerraum zusammen", () => {
    expect(normalizeName("Kaufland    Nord")).toBe("Kaufland Nord");
  });

  it("kürzt zu lange Namen", () => {
    expect(normalizeName("A".repeat(MAX_NAME_LAENGE + 20)).length).toBe(MAX_NAME_LAENGE);
  });

  it("macht aus reinem Leerraum einen leeren Namen", () => {
    // Der Aufrufer erkennt daran, dass nichts eingegeben wurde.
    expect(normalizeName("   ")).toBe("");
  });
});

describe("nameVergeben", () => {
  it("erkennt denselben Namen in anderer Schreibweise", () => {
    expect(nameVergeben("lidl", ["Lidl", "Edeka"])).toBe(true);
    expect(nameVergeben("  EDEKA ", ["Lidl", "Edeka"])).toBe(true);
  });

  it("lässt neue Namen durch", () => {
    expect(nameVergeben("Rewe", ["Lidl", "Edeka"])).toBe(false);
  });

  it("vergleicht auch die vorhandenen aufgeräumt", () => {
    expect(nameVergeben("Rewe", ["  rewe  "])).toBe(true);
  });
});
