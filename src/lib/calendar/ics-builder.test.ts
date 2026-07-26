import { describe, it, expect } from "vitest";
import { buildIcs } from "./ics-builder";
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
