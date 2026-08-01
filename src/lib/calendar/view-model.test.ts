import { describe, it, expect } from "vitest";
import { buildWeek } from "./view-model";
import { expandOccurrences } from "./ical";
import { ICS_SINGLE, ICS_SERIES_OVERRIDE } from "./fixtures";

const FROM = new Date("2026-07-01T00:00:00Z");
const TO = new Date("2026-08-15T00:00:00Z");

/**
 * Die Woche hebt den nächsten noch anstehenden Termin von heute hervor. Dafür
 * bildet die Seite den Schlüssel selbst nach. Weicht die Bildung hier ab,
 * greift die Hervorhebung ins Leere — ohne dass irgendetwas kaputtgeht.
 * Deshalb dieser Test.
 */
describe("buildWeek — Schlüssel der Termine", () => {
  it("setzt sich aus UID und Vorkommen zusammen", () => {
    const occ = expandOccurrences(ICS_SINGLE, FROM, TO);
    const days = buildWeek(occ, new Map(), new Date("2026-07-28T06:00:00Z"));
    const ev = days.flatMap((d) => d.events)[0];
    expect(ev.key).toBe(`${occ[0].uid}:${occ[0].recurrenceId}`);
  });

  it("unterscheidet die Vorkommen einer Serie", () => {
    const occ = expandOccurrences(ICS_SERIES_OVERRIDE, FROM, TO);
    const days = buildWeek(occ, new Map(), new Date("2026-07-07T06:00:00Z"));
    const keys = days.flatMap((d) => d.events).map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const o of occ) expect(keys).toContain(`${o.uid}:${o.recurrenceId}`);
  });
});
