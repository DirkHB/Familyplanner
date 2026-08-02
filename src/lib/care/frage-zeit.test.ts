import { describe, it, expect } from "vitest";
import { frageFaellig } from "./frage-zeit";

// Berliner Sommerzeit: 12:00 lokal = 10:00 UTC.
const mittag = new Date("2026-08-03T10:00:00.000Z");

describe("frageFaellig", () => {
  it("heute Abend 18 Uhr, wenn der Termin erst morgen ist", () => {
    const termin = new Date("2026-08-04T07:00:00.000Z"); // morgen 09:00 Berlin
    expect(frageFaellig(mittag, termin).toISOString()).toBe("2026-08-03T16:00:00.000Z");
  });

  it("rückt vor den Termin, wenn der vor dem Abend liegt", () => {
    const termin = new Date("2026-08-03T15:00:00.000Z"); // heute 17:00 Berlin
    // Drei Stunden Vorlauf: 14:00 Berlin.
    expect(frageFaellig(mittag, termin).toISOString()).toBe("2026-08-03T12:00:00.000Z");
  });

  it("fällt nie in die Vergangenheit — dann eben in einer halben Stunde", () => {
    const termin = new Date("2026-08-03T11:00:00.000Z"); // heute 13:00 Berlin, Vorlauf wäre 10:00
    expect(frageFaellig(mittag, termin).toISOString()).toBe("2026-08-03T10:30:00.000Z");
  });

  it("ohne bekannten Terminbeginn gilt schlicht heute Abend", () => {
    expect(frageFaellig(mittag, null).toISOString()).toBe("2026-08-03T16:00:00.000Z");
  });

  it("bleibt in der Winterzeit bei 18 Uhr Berlin", () => {
    const winterMittag = new Date("2026-12-07T11:00:00.000Z");
    expect(frageFaellig(winterMittag, null).toISOString()).toBe("2026-12-07T17:00:00.000Z");
  });
});
