import { describe, it, expect } from "vitest";
import { guessShoppingCategory, SHOPPING_CATEGORY_ORDER } from "./categories";

describe("guessShoppingCategory", () => {
  it("erkennt Baby-Artikel", () => {
    expect(guessShoppingCategory("Windeln Größe 2")).toBe("baby");
  });
  it("erkennt Frisches", () => {
    expect(guessShoppingCategory("Bananen")).toBe("frisches");
    expect(guessShoppingCategory("Haferdrink")).toBe("frisches");
  });
  it("erkennt Haushalt", () => {
    expect(guessShoppingCategory("Spülmaschinentabs")).toBe("haushalt");
  });
  it("erkennt Vorrat", () => {
    expect(guessShoppingCategory("Kaffeebohnen")).toBe("vorrat");
  });
  it("fällt auf sonstiges zurück", () => {
    expect(guessShoppingCategory("Geschenkpapier")).toBe("sonstiges");
  });
  it("Reihenfolge beginnt mit Frisches", () => {
    expect(SHOPPING_CATEGORY_ORDER[0]).toBe("frisches");
  });
});
