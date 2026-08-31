import { describe, it, expect } from "vitest";
import {
  MIN_TAGE,
  brauchtFrage,
  istBesuch,
  istWeg,
  kommtInFrage,
} from "./abwesenheit";

describe("Welche Einträge überhaupt gemeint sind", () => {
  it("nimmt nur Ganztägiges über mehrere Tage", () => {
    expect(kommtInFrage(true, MIN_TAGE)).toBe(true);
    // Ein einzelner Ganztagstag ist ein Geburtstag oder ein Feiertag.
    expect(kommtInFrage(true, 1)).toBe(false);
    // Ein Termin mit Uhrzeit ist nie eine Abwesenheit über Tage.
    expect(kommtInFrage(false, 5)).toBe(false);
  });
});

describe("Seid ihr weg?", () => {
  it("nimmt die Vermutung der Maschine, solange niemand geantwortet hat", () => {
    expect(istWeg(undefined, "wegfahrt")).toBe(true);
    expect(istWeg(undefined, "besuch")).toBe(false);
    expect(istWeg(undefined, "zustand")).toBe(false);
  });

  it("lässt den Menschen die Maschine überstimmen — in beide Richtungen", () => {
    expect(istWeg("nein", "wegfahrt")).toBe(false);
    expect(istWeg("ja", "zustand")).toBe(true);
  });

  it("hält Unsicherheit von einem Nein auseinander", () => {
    // Unsicher ist nicht dasselbe wie „ihr seid da" — daraus wird die Frage.
    expect(istWeg(undefined, "unklar")).toBe(false);
    expect(brauchtFrage(undefined, "unklar")).toBe(true);
  });
});

describe("Wann gefragt wird", () => {
  it("fragt nur, wenn die Maschine unsicher war", () => {
    expect(brauchtFrage(undefined, "wegfahrt")).toBe(false);
    expect(brauchtFrage(undefined, "besuch")).toBe(false);
    expect(brauchtFrage(undefined, "zustand")).toBe(false);
  });

  it("fragt nicht mehr, wenn ein Mensch geantwortet hat", () => {
    expect(brauchtFrage("ja", "unklar")).toBe(false);
    expect(brauchtFrage("nein", "unklar")).toBe(false);
  });

  it("fragt gar nicht, wenn es keine Einordnung gibt", () => {
    // Ohne KI lieber schweigen als zu jedem Balken im Kalender fragen.
    expect(brauchtFrage(undefined, undefined)).toBe(false);
  });
});

describe("Besuch", () => {
  it("erkennt einen Besuch nur aus der Einordnung", () => {
    expect(istBesuch(undefined, "besuch")).toBe(true);
    expect(istBesuch(undefined, "wegfahrt")).toBe(false);
  });

  it("schweigt, sobald ein Mensch etwas gesagt hat", () => {
    // Ein „wir sind weg" beantwortet auch, dass es kein Besuch war.
    expect(istBesuch("nein", "besuch")).toBe(false);
  });
});
