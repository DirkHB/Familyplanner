import { describe, it, expect } from "vitest";
import {
  PLATZ_A,
  PLATZ_B,
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
