import { describe, it, expect } from "vitest";
import { buildIcs, ohneZeitstempel } from "./ics-builder";
import { parseEvents, expandOccurrences } from "./ical";

describe("buildIcs (Round-Trip durch den Parser)", () => {
  it("timed Event bleibt zeit- und titeltreu", () => {
    const start = new Date("2026-07-30T13:00:00Z");
    const end = new Date("2026-07-30T13:45:00Z");
    const ics = buildIcs(
      { uid: "u1@planyourweek.app", title: "Kinderarzt, U3", start, end, allDay: false, location: "Praxis; Behrens" },
      new Date("2026-07-27T00:00:00Z"),
    );
    const [p] = parseEvents(ics);
    expect(p.uid).toBe("u1@planyourweek.app");
    expect(p.summary).toBe("Kinderarzt, U3"); // Komma korrekt ent-escaped
    expect(p.location).toBe("Praxis; Behrens"); // Semikolon korrekt ent-escaped
    expect(p.start.toISOString()).toBe("2026-07-30T13:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-07-30T13:45:00.000Z");
    expect(p.allDay).toBe(false);
  });

  it("all-day Event bleibt Datum", () => {
    const start = new Date("2026-08-01T00:00:00Z");
    const end = new Date("2026-08-02T00:00:00Z");
    const ics = buildIcs({ uid: "u2", title: "Geburtstag Oma", start, end, allDay: true });
    const [p] = parseEvents(ics);
    expect(p.allDay).toBe(true);
    expect(p.startDate).toBe("2026-08-01");
  });

  it("erscheint als Vorkommen im Fenster", () => {
    const start = new Date("2026-07-30T13:00:00Z");
    const ics = buildIcs({ uid: "u3", title: "Tennis", start, end: new Date("2026-07-30T14:30:00Z"), allDay: false });
    const occ = expandOccurrences(ics, new Date("2026-07-01T00:00:00Z"), new Date("2026-08-15T00:00:00Z"));
    expect(occ).toHaveLength(1);
    expect(occ[0].summary).toBe("Tennis");
  });

  it("nutzt CRLF-Zeilenenden", () => {
    const ics = buildIcs({ uid: "u4", title: "X", start: new Date("2026-07-30T10:00:00Z"), end: new Date("2026-07-30T11:00:00Z"), allDay: false });
    expect(ics).toContain("\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });
});

describe("X-Eigenschaften", () => {
  it("schreibt zusaetzliche Kennzeichen ins VEVENT", () => {
    const ics = buildIcs({
      uid: "fp-care-1@planyourweek.app",
      title: "Nicolas",
      start: new Date("2026-08-03T08:00:00Z"),
      end: new Date("2026-08-03T09:00:00Z"),
      allDay: false,
      xProps: { "X-PLANYOURWEEK-BETREUUNG": "dirk" },
    });
    expect(ics).toContain("X-PLANYOURWEEK-BETREUUNG:dirk");
  });

  it("bleibt ohne Kennzeichen unveraendert", () => {
    const ics = buildIcs({
      uid: "fp-1@planyourweek.app",
      title: "Zahnarzt",
      start: new Date("2026-08-03T08:00:00Z"),
      end: new Date("2026-08-03T09:00:00Z"),
      allDay: false,
    });
    expect(ics).not.toContain("X-PLANYOURWEEK");
  });

  it("vergleicht zwei Fassungen ohne den Zeitstempel", () => {
    // Derselbe Termin, eine Sekunde später geschrieben. Ohne diese Klammer
    // hielte der Vergleich in block-sync nie — und jeder Lauf schriebe alle
    // Betreuungsblöcke des Tages neu nach iCloud.
    const ev = {
      uid: "fp-care-2026-08-10-a@planyourweek.app",
      title: "👶 das Baby · Dirk",
      start: new Date("2026-08-10T09:00:00Z"),
      end: new Date("2026-08-10T10:00:00Z"),
      allDay: false,
    };
    const frueh = buildIcs(ev, new Date("2026-08-09T20:00:00Z"));
    const spaet = buildIcs(ev, new Date("2026-08-09T20:00:01Z"));

    expect(frueh).not.toBe(spaet);
    expect(ohneZeitstempel(frueh)).toBe(ohneZeitstempel(spaet));
    expect(ohneZeitstempel(frueh)).not.toContain("DTSTAMP");
    // Alles andere bleibt stehen — sonst würde der Vergleich echte
    // Unterschiede mit verschlucken.
    expect(ohneZeitstempel(frueh)).toContain("SUMMARY:👶 das Baby · Dirk");
    expect(ohneZeitstempel(frueh)).toContain("DTSTART:20260810T090000Z");
  });

  it("sieht einen echten Unterschied weiterhin", () => {
    const basis = {
      uid: "u1",
      start: new Date("2026-08-10T09:00:00Z"),
      end: new Date("2026-08-10T10:00:00Z"),
      allDay: false,
    };
    const jetzt = new Date("2026-08-09T20:00:00Z");
    const a = buildIcs({ ...basis, title: "👶 das Baby · Dirk" }, jetzt);
    const b = buildIcs({ ...basis, title: "👶 das Baby · Constanze" }, jetzt);
    expect(ohneZeitstempel(a)).not.toBe(ohneZeitstempel(b));
  });
});
