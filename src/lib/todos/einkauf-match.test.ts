import { describe, it, expect } from "vitest";
import { kernwoerter, meintDasselbe, findeEinkaufTreffer } from "./einkauf-match";

describe("kernwoerter", () => {
  it("wirft Verben und Füllwörter weg", () => {
    expect([...kernwoerter("Abschiedsgeschenk für Regina kaufen")]).toEqual([
      "abschiedsgeschenk",
      "regina",
    ]);
  });

  it("führt Ein- und Mehrzahl zusammen", () => {
    expect(kernwoerter("Windeln")).toEqual(kernwoerter("Windel"));
    expect(kernwoerter("Hosen besorgen")).toEqual(kernwoerter("Hose"));
  });

  it("lässt Namen in Ruhe", () => {
    expect([...kernwoerter("Regina")]).toEqual(["regina"]);
  });

  it("versteht Umlaute wie geschrieben oder umschrieben", () => {
    expect(kernwoerter("Käfer")).toEqual(kernwoerter("Kaefer"));
  });
});

describe("meintDasselbe", () => {
  it("erkennt die Aufgabe im Einkaufseintrag wieder", () => {
    expect(meintDasselbe("Abschiedsgeschenk für Regina kaufen", "Abschiedsgeschenk für Regina")).toBe(true);
    expect(meintDasselbe("Windeln bestellen", "Windeln")).toBe(true);
  });

  it("verwechselt nicht, wem das Geschenk gilt", () => {
    expect(meintDasselbe("Geschenk für Oma kaufen", "Geschenk für Regina")).toBe(false);
  });

  it("hakt keinen Sammeleintrag wegen eines einzigen Worts ab", () => {
    expect(meintDasselbe("Milch kaufen", "Milch, Butter, Eier und Brot")).toBe(false);
  });

  it("braucht ein Wort mit Substanz", () => {
    // Nur kurze Wörter — daraus lässt sich keine Gleichheit behaupten.
    expect(meintDasselbe("Eis", "Eis")).toBe(false);
  });

  it("verträgt leere und reine Füllwort-Texte", () => {
    expect(meintDasselbe("", "Windeln")).toBe(false);
    expect(meintDasselbe("noch besorgen", "Windeln")).toBe(false);
  });

  it("nimmt einen Zusatz im Einkaufseintrag hin", () => {
    expect(meintDasselbe("Geschenk Regina", "Geschenk Regina Käfer")).toBe(true);
  });
});

describe("findeEinkaufTreffer", () => {
  const artikel = [
    { id: "1", text: "Milch" },
    { id: "2", text: "Abschiedsgeschenk für Regina" },
    { id: "3", text: "Abschiedsgeschenk für Regina beim Käfer abholen" },
  ];

  it("findet den knappsten passenden Eintrag", () => {
    expect(findeEinkaufTreffer("Abschiedsgeschenk für Regina kaufen", artikel)?.id).toBe("2");
  });

  it("gibt nichts zurück, wenn nichts passt", () => {
    expect(findeEinkaufTreffer("Kindergeld-Antrag abschicken", artikel)).toBe(null);
    expect(findeEinkaufTreffer("Windeln bestellen", [])).toBe(null);
  });
});
