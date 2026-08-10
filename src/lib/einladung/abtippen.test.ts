import { describe, it, expect } from "vitest";
import { abtippen } from "./abtippen";

/**
 * Die Zeichenkette, die vor dem Löschen abgetippt werden muss. Sie darf sich
 * nicht zwischen zwei Haushalten wiederholen — sonst löscht ein Abtippen den
 * falschen.
 */
describe("Bestätigung beim Löschen", () => {
  it("ist die Adresse des Ersten", () => {
    expect(
      abtippen({ id: "h1", users: [{ email: "thomas@example.com" }, { email: "y@example.com" }] }),
    ).toBe("thomas@example.com");
  });

  it("nimmt die Kennung, wenn noch niemand dort wohnt", () => {
    expect(abtippen({ id: "h1", users: [] })).toBe("h1");
  });

  it("unterscheidet zwei Haushalte", () => {
    const a = abtippen({ id: "h1", users: [{ email: "eins@example.com" }] });
    const b = abtippen({ id: "h2", users: [{ email: "zwei@example.com" }] });
    expect(a).not.toBe(b);
  });
});
