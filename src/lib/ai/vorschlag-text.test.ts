import { describe, it, expect } from "vitest";
import { nuechternerVorschlag } from "./vorschlag-text";

/**
 * Nur der Rückfall wird geprüft — er ist der Text, der auch dann ankommt,
 * wenn die KI nicht antwortet. Genau deshalb muss er ohne Netz stimmen.
 */
describe("nuechternerVorschlag", () => {
  const aufgabe = { titel: "Kindergeld-Antrag", faellig: "heute", liste: "Papierkram" };

  it("nennt bei freiem Fenster das Ende und die erste Aufgabe", () => {
    const t = nuechternerVorschlag({
      fenster: "14:00–16:30",
      fensterMinuten: 150,
      aufgaben: [aufgabe],
      morgenFrei: [],
    });
    expect(t).toContain("16:30");
    expect(t).toContain("Kindergeld-Antrag");
  });

  it("zählt weitere Aufgaben, statt sie aufzuzählen", () => {
    const t = nuechternerVorschlag({
      fenster: "14:00–16:30",
      fensterMinuten: 150,
      aufgaben: [aufgabe, { titel: "B", faellig: null, liste: null }, { titel: "C", faellig: null, liste: null }],
      morgenFrei: [],
    });
    expect(t).toContain("2 weitere");
    expect(t).not.toContain("„B\"");
  });

  it("verweist ohne Fenster auf morgen", () => {
    const t = nuechternerVorschlag({
      fenster: null,
      fensterMinuten: null,
      aufgaben: [aufgabe],
      morgenFrei: ["ab 10:00"],
    });
    expect(t).toContain("Morgen ab 10:00");
  });

  it("bleibt ohne alles verständlich", () => {
    expect(
      nuechternerVorschlag({ fenster: null, fensterMinuten: null, aufgaben: [], morgenFrei: [] }),
    ).toContain("Nichts Offenes");
  });
});
