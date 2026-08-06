import { describe, it, expect } from "vitest";
import { formatTime, formatWeekday, dayKey, groupByDay } from "./format";
import type { Occurrence } from "./types";

function occ(startIso: string, summary = "X"): Occurrence {
  const start = new Date(startIso);
  return {
    uid: summary,
    summary,
    location: null,
    start,
    end: new Date(start.getTime() + 3600_000),
    allDay: false,
    startDate: null,
    recurrenceId: startIso,
    isException: false,
  };
}

describe("format (Europe/Berlin)", () => {
  it("zeigt UTC-Instant in Berliner Zeit (Sommerzeit +2h)", () => {
    expect(formatTime(new Date("2026-07-28T08:15:00Z"))).toBe("10:15");
  });

  it("zeigt Winterzeit (+1h)", () => {
    expect(formatTime(new Date("2026-01-15T08:15:00Z"))).toBe("09:15");
  });

  it("Wochentag deutsch", () => {
    // 2026-07-27 ist ein Montag
    expect(formatWeekday(new Date("2026-07-27T09:00:00Z"))).toBe("Montag");
  });

  it("dayKey nutzt Berliner Tagesgrenze", () => {
    // 22:30Z im Sommer = 00:30 Berlin am Folgetag
    expect(dayKey(new Date("2026-07-27T22:30:00Z"))).toBe("2026-07-28");
  });
});

describe("groupByDay", () => {
  it("gruppiert und sortiert chronologisch", () => {
    const groups = groupByDay(
      [occ("2026-07-28T14:00:00Z", "B"), occ("2026-07-27T07:00:00Z", "A"), occ("2026-07-28T06:00:00Z", "C")],
      new Date("2026-07-27T10:00:00Z"),
    );
    expect(groups.map((g) => g.key)).toEqual(["2026-07-27", "2026-07-28"]);
    expect(groups[0].isToday).toBe(true);
    expect(groups[1].isToday).toBe(false);
    // innerhalb des Tages sortiert
    expect(groups[1].occurrences.map((o) => o.summary)).toEqual(["C", "B"]);
  });
});

describe("greetingFor", () => {
  // 17:55 Berlin im Sommer = 15:55 UTC — der gemeldete Bug-Fall.
  it("sagt um 17:55 Guten Abend (nicht Gute Nacht)", async () => {
    const { greetingFor } = await import("./format");
    expect(greetingFor(new Date("2026-07-30T15:55:00Z"))).toBe("Guten Abend");
  });
  it("deckt alle Zeitfenster ab", async () => {
    const { greetingFor } = await import("./format");
    expect(greetingFor(new Date("2026-07-30T06:00:00Z"))).toBe("Guten Morgen"); // 08:00
    expect(greetingFor(new Date("2026-07-30T10:00:00Z"))).toBe("Hallo"); // 12:00
    expect(greetingFor(new Date("2026-07-30T20:30:00Z"))).toBe("Gute Nacht"); // 22:30
    expect(greetingFor(new Date("2026-07-30T01:00:00Z"))).toBe("Gute Nacht"); // 03:00
  });
});

describe("wannLabel", () => {
  // Montag, 3. August 2026, 12:00 Berlin (10:00 UTC).
  const NOW = new Date("2026-08-03T10:00:00Z");

  it("sagt heute und morgen statt eines Datums", async () => {
    const { wannLabel } = await import("./format");
    expect(wannLabel(new Date("2026-08-03T14:00:00Z"), false, NOW)).toBe("heute, 16:00");
    expect(wannLabel(new Date("2026-08-04T14:00:00Z"), false, NOW)).toBe("morgen, 16:00");
  });

  it("nennt weiter entfernte Termine mit Wochentag und Datum", async () => {
    const { wannLabel } = await import("./format");
    expect(wannLabel(new Date("2026-08-06T14:00:00Z"), false, NOW)).toBe("Do, 6. August, 16:00");
  });

  it("lässt bei ganztägigen Terminen die Uhrzeit weg", async () => {
    const { wannLabel } = await import("./format");
    expect(wannLabel(new Date("2026-08-04T00:00:00Z"), true, NOW)).toBe("morgen");
  });

  it("trifft morgen auch über die Zeitumstellung", async () => {
    const { wannLabel } = await import("./format");
    // Sonntag, 25.10.2026 ist der Umstellungstag (Sommer- auf Winterzeit).
    const samstag = new Date("2026-10-24T10:00:00Z"); // 12:00 Berlin
    expect(wannLabel(new Date("2026-10-25T11:00:00Z"), false, samstag)).toBe("morgen, 12:00");
  });
});
