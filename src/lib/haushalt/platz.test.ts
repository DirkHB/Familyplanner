import { describe, it, expect } from "vitest";
import {
  PLATZ_A,
  PLATZ_B,
  istPlatzWert,
  platzFuerEmail,
  emailFuerPlatz,
  andererPlatz,
  platzNachReihenfolge,
} from "./platz";
import type { HaushaltProfil } from "./profil";

/**
 * Der Fehler, den diese Tests festhalten: Vorher entschied eine feste Adresse
 * im Code, wer Platz A ist — jede andere wurde Platz B. In einem zweiten
 * Haushalt waren damit beide Erwachsenen dieselbe Person.
 */
const wirZwei: HaushaltProfil = {
  erwachsene: [
    { slot: PLATZ_A, name: "Dirk", email: "dirk@example.com" },
    { slot: PLATZ_B, name: "Constanze", email: "constanze@example.com" },
  ],
  kind: "Nicolas",
};

const zweiterHaushalt: HaushaltProfil = {
  erwachsene: [
    { slot: PLATZ_A, name: "Thomas", email: "thomas@example.com" },
    { slot: PLATZ_B, name: "Yvonne", email: "yvonne@example.com" },
  ],
  kind: "das Baby",
};

describe("platzFuerEmail", () => {
  it("gibt jedem seinen eigenen Platz", () => {
    expect(platzFuerEmail(wirZwei, "dirk@example.com")).toBe(PLATZ_A);
    expect(platzFuerEmail(wirZwei, "constanze@example.com")).toBe(PLATZ_B);
  });

  it("tut das auch in einem Haushalt, den der Code nicht kennt", () => {
    const a = platzFuerEmail(zweiterHaushalt, "thomas@example.com");
    const b = platzFuerEmail(zweiterHaushalt, "yvonne@example.com");
    expect(a).not.toBe(b);
  });

  it("stört sich nicht an Groß- und Kleinschreibung", () => {
    expect(platzFuerEmail(zweiterHaushalt, " Yvonne@Example.com ")).toBe(PLATZ_B);
  });

  it("fällt für Fremde auf den ersten Platz zurück, statt zu werfen", () => {
    expect(platzFuerEmail(wirZwei, "fremd@example.com")).toBe(PLATZ_A);
    expect(platzFuerEmail(wirZwei, null)).toBe(PLATZ_A);
  });
});

describe("emailFuerPlatz", () => {
  it("findet den Weg zurück", () => {
    expect(emailFuerPlatz(zweiterHaushalt, PLATZ_B)).toBe("yvonne@example.com");
  });

  it("gibt null, wenn der Platz unbesetzt ist", () => {
    const allein: HaushaltProfil = { erwachsene: [zweiterHaushalt.erwachsene[0]], kind: "x" };
    expect(emailFuerPlatz(allein, PLATZ_B)).toBeNull();
  });
});

describe("Reihenfolge und Gegenstück", () => {
  it("vergibt Plätze nach der Reihenfolge der Allowlist", () => {
    expect(platzNachReihenfolge(0)).toBe(PLATZ_A);
    expect(platzNachReihenfolge(1)).toBe(PLATZ_B);
  });

  it("nennt den jeweils anderen", () => {
    expect(andererPlatz(PLATZ_A)).toBe(PLATZ_B);
    expect(andererPlatz(PLATZ_B)).toBe(PLATZ_A);
  });
});

/**
 * Der Fehler, den wir im echten Kalender gesehen haben: „👶 Nicolas ·
 * constanze“ und „In dirks Kalender“. Klein geschriebene Platz-Werte, die
 * sich als Namen ausgaben — und dann in Kalendereinträgen landeten.
 */
describe("istPlatzWert", () => {
  it("erkennt den Platz-Wert, wie Code ihn schreibt", () => {
    expect(istPlatzWert("dirk")).toBe(true);
    expect(istPlatzWert("constanze")).toBe(true);
    expect(istPlatzWert(" dirk ")).toBe(true);
  });

  it("nimmt einem Menschen namens Dirk nicht seinen Namen weg", () => {
    // Der erste Versuch verglich klein geschrieben — und warf damit genau die
    // Namen weg, die er schützen sollte. Unser eigener Haushalt.
    expect(istPlatzWert("Dirk")).toBe(false);
    expect(istPlatzWert("Constanze")).toBe(false);
  });

  it("lässt alle anderen Namen in Ruhe", () => {
    expect(istPlatzWert("Dirk Brederecke")).toBe(false);
    expect(istPlatzWert("Thomas")).toBe(false);
    expect(istPlatzWert("Yvonne")).toBe(false);
    expect(istPlatzWert(null)).toBe(false);
  });
});
