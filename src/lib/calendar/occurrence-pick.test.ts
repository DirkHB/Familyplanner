import { describe, it, expect } from "vitest";
import { expandOccurrences } from "./ical";
import { headForOccurrence, pickOccurrence } from "./occurrence-pick";
import { ICS_SERIES_OVERRIDE, ICS_SINGLE } from "./fixtures";

const FROM = new Date("2026-07-01T00:00:00Z");
const TO = new Date("2026-08-15T00:00:00Z");

/** Die Serie heißt „Tennis"; der 14.07. wurde einzeln zu „Tennis (verschoben)". */
const SERIE = { title: "Tennis", location: null };

describe("pickOccurrence", () => {
  it("nimmt das nächste noch nicht beendete Vorkommen", () => {
    const occ = expandOccurrences(ICS_SERIES_OVERRIDE, FROM, TO);
    const next = pickOccurrence(occ, new Date("2026-07-14T12:00:00Z"));
    expect(next!.start.toISOString()).toBe("2026-07-14T19:00:00.000Z");
  });

  it("fällt auf das letzte Vorkommen zurück, wenn alles vorbei ist", () => {
    const occ = expandOccurrences(ICS_SERIES_OVERRIDE, FROM, TO);
    const next = pickOccurrence(occ, new Date("2026-12-01T00:00:00Z"));
    expect(next).toBe(occ[occ.length - 1]);
  });

  it("gibt null zurück, wenn es kein Vorkommen gibt", () => {
    expect(pickOccurrence([], new Date())).toBeNull();
  });
});

describe("headForOccurrence", () => {
  it("zeigt den Titel des einzeln geänderten Termins, nicht den der Serie", () => {
    const occ = expandOccurrences(ICS_SERIES_OVERRIDE, FROM, TO);
    const geaendert = pickOccurrence(occ, new Date("2026-07-14T12:00:00Z"));
    expect(headForOccurrence(geaendert, SERIE).title).toBe("Tennis (verschoben)");
  });

  it("zeigt bei allen übrigen Terminen weiter den Serientitel", () => {
    const occ = expandOccurrences(ICS_SERIES_OVERRIDE, FROM, TO);
    const normal = pickOccurrence(occ, new Date("2026-07-21T12:00:00Z"));
    expect(normal!.isException).toBe(false);
    expect(headForOccurrence(normal, SERIE).title).toBe("Tennis");
  });

  it("übernimmt den Ort des Vorkommens", () => {
    const occ = expandOccurrences(ICS_SINGLE, FROM, TO);
    const head = headForOccurrence(pickOccurrence(occ, FROM), { title: "alt", location: null });
    expect(head.title).toBe("Kinderarzt U3");
    expect(head.location).toBe("Praxis Dr. Behrens");
  });

  it("behält die Serienwerte, wenn kein Vorkommen ermittelbar war", () => {
    expect(headForOccurrence(null, SERIE)).toEqual(SERIE);
  });
});
