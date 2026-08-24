import { describe, it, expect } from "vitest";
import {
  istGeburtstag,
  personAusTitel,
  geschenkAufgabe,
  faelligFuer,
  istImFragefenster,
} from "./geburtstag";

describe("Geburtstag erkennen", () => {
  it("erkennt die Schreibweisen, die Kalender wirklich erzeugen", () => {
    // Apple, Google, von Hand — drei Sprachen für dieselbe Sache.
    expect(personAusTitel("Omas Geburtstag")).toBe("Oma");
    expect(personAusTitel("Oma hat Geburtstag")).toBe("Oma");
    expect(personAusTitel("Geburtstag Oma")).toBe("Oma");
    expect(personAusTitel("Geburtstag von Oma")).toBe("Oma");
    expect(personAusTitel("Geburtstag: Oma")).toBe("Oma");
    expect(personAusTitel("🎂 Kim hat Geburtstag")).toBe("Kim");
  });

  it("rät keinen Namen, wenn keiner dasteht", () => {
    // Ein falsch geratener Name in einer Frage ist schlimmer als gar keiner.
    expect(personAusTitel("Geburtstagsfeier")).toBeNull();
    expect(personAusTitel("Geburtstag")).toBeNull();
  });

  it("hält Nicht-Geburtstage heraus", () => {
    expect(istGeburtstag("Zahnarzt")).toBe(false);
    expect(istGeburtstag("Omas Geburtstag")).toBe(true);
  });
});

describe("Wann gefragt wird", () => {
  const geburtstag = new Date("2026-08-22T00:00:00Z");

  it("fragt in den Tagen davor", () => {
    expect(istImFragefenster(geburtstag, new Date("2026-08-19T09:00:00Z"))).toBe(true);
    expect(istImFragefenster(geburtstag, new Date("2026-08-21T09:00:00Z"))).toBe(true);
  });

  it("fragt am Tag selbst nicht mehr", () => {
    // Dann ist die Frage nach einem Geschenk keine Hilfe mehr, sondern ein
    // Vorwurf — gratuliert wird trotzdem, dafür gibt es den Termin.
    expect(istImFragefenster(geburtstag, new Date("2026-08-22T09:00:00Z"))).toBe(false);
  });

  it("fragt nicht zu früh", () => {
    expect(istImFragefenster(geburtstag, new Date("2026-08-10T09:00:00Z"))).toBe(false);
  });
});

describe("Was daraus entsteht", () => {
  it("benennt die Aufgabe nach der Person", () => {
    expect(geschenkAufgabe("Oma", "Omas Geburtstag")).toBe("Geschenk für Oma besorgen");
  });

  it("wird einen Tag vor dem Geburtstag fällig", () => {
    // Am Tag selbst stünde sie neben dem Anlass und wäre nutzlos.
    const g = new Date("2026-08-22T00:00:00Z");
    expect(faelligFuer(g).toISOString()).toBe("2026-08-21T00:00:00.000Z");
  });
});
