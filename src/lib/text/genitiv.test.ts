import { describe, it, expect } from "vitest";
import { besitzform } from "./genitiv";

describe("besitzform", () => {
  it("hängt bei gewöhnlichen Namen ein s an", () => {
    expect(besitzform("Dirk")).toBe("Dirks");
    expect(besitzform("Constanze")).toBe("Constanzes");
    expect(besitzform("Yvonne")).toBe("Yvonnes");
  });

  it("setzt bei s-Lauten nur einen Apostroph", () => {
    expect(besitzform("Thomas")).toBe("Thomas’");
    expect(besitzform("Lukas")).toBe("Lukas’");
    expect(besitzform("Max")).toBe("Max’");
    expect(besitzform("Franz")).toBe("Franz’");
  });

  it("kommt mit Leerem und Rändern klar", () => {
    expect(besitzform("  Alex  ")).toBe("Alex’");
    expect(besitzform("")).toBe("");
  });
});
