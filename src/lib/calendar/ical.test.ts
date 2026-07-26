import { describe, it, expect } from "vitest";
import { parseEvents, expandOccurrences } from "./ical";
import {
  ICS_SINGLE,
  ICS_ALLDAY,
  ICS_WEEKLY_EXDATE,
  ICS_SERIES_OVERRIDE,
} from "./fixtures";

const WINDOW_FROM = new Date("2026-07-01T00:00:00Z");
const WINDOW_TO = new Date("2026-08-15T00:00:00Z");

describe("parseEvents", () => {
  it("liest einen einfachen Termin (UTC, Ort)", () => {
    const [e] = parseEvents(ICS_SINGLE);
    expect(e.uid).toBe("single-1@planyourweek.app");
    expect(e.summary).toBe("Kinderarzt U3");
    expect(e.location).toBe("Praxis Dr. Behrens");
    expect(e.allDay).toBe(false);
    expect(e.start.toISOString()).toBe("2026-07-28T08:15:00.000Z");
  });

  it("erkennt ganztägige Termine als reines Datum", () => {
    const [e] = parseEvents(ICS_ALLDAY);
    expect(e.allDay).toBe(true);
    expect(e.startDate).toBe("2026-07-28");
  });
});

describe("expandOccurrences — einfach & all-day", () => {
  it("Einzeltermin → genau ein Vorkommen", () => {
    const occ = expandOccurrences(ICS_SINGLE, WINDOW_FROM, WINDOW_TO);
    expect(occ).toHaveLength(1);
    expect(occ[0].start.toISOString()).toBe("2026-07-28T08:15:00.000Z");
    expect(occ[0].isException).toBe(false);
  });

  it("Einzeltermin außerhalb des Fensters → keins", () => {
    const occ = expandOccurrences(
      ICS_SINGLE,
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-09-30T00:00:00Z"),
    );
    expect(occ).toHaveLength(0);
  });

  it("all-day bleibt Datum", () => {
    const occ = expandOccurrences(ICS_ALLDAY, WINDOW_FROM, WINDOW_TO);
    expect(occ).toHaveLength(1);
    expect(occ[0].allDay).toBe(true);
    expect(occ[0].startDate).toBe("2026-07-28");
  });
});

describe("expandOccurrences — Wiederholungen", () => {
  it("EXDATE entfernt genau die ausgeschlossene Instanz", () => {
    const occ = expandOccurrences(ICS_WEEKLY_EXDATE, WINDOW_FROM, WINDOW_TO);
    // 5x wöchentlich minus 1 EXDATE = 4
    expect(occ).toHaveLength(4);
    const days = occ.map((o) => o.start.toISOString().slice(0, 10));
    expect(days).toEqual(["2026-07-07", "2026-07-14", "2026-07-28", "2026-08-04"]);
    expect(days).not.toContain("2026-07-21");
  });

  it("RECURRENCE-ID: verschobene Einzelausnahme, Serie bleibt intakt", () => {
    const occ = expandOccurrences(ICS_SERIES_OVERRIDE, WINDOW_FROM, WINDOW_TO);
    expect(occ).toHaveLength(4);

    const moved = occ.find((o) => o.isException);
    expect(moved).toBeDefined();
    // ursprünglich 17:00Z am 14.07 → verschoben auf 19:00Z
    expect(moved!.recurrenceId).toContain("2026-07-14");
    expect(moved!.start.toISOString()).toBe("2026-07-14T19:00:00.000Z");
    expect(moved!.summary).toBe("Tennis (verschoben)");

    // die anderen drei unverändert um 17:00Z
    const normal = occ.filter((o) => !o.isException);
    expect(normal).toHaveLength(3);
    for (const o of normal) {
      expect(o.start.toISOString().slice(11)).toBe("17:00:00.000Z");
      expect(o.summary).toBe("Tennis");
    }
  });

  it("Fenster begrenzt die Vorkommen", () => {
    const occ = expandOccurrences(
      ICS_SERIES_OVERRIDE,
      new Date("2026-07-15T00:00:00Z"),
      new Date("2026-07-29T00:00:00Z"),
    );
    // nur 21.07 und 28.07
    expect(occ).toHaveLength(2);
    expect(occ.map((o) => o.start.toISOString().slice(0, 10))).toEqual([
      "2026-07-21",
      "2026-07-28",
    ]);
  });
});
