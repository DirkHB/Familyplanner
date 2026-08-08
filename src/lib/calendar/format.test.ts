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

describe("groupByDay mit mehrtägigem Ganztägigem", () => {
  const urlaub = {
    uid: "u1",
    recurrenceId: "",
    summary: "Urlaub Italien",
    // Ganztägig endet exklusiv: 10.–15. heißt bis einschließlich 14.
    // So sieht es aus, wenn der Server auf UTC läuft.
    start: new Date("2026-08-10T00:00:00Z"),
    end: new Date("2026-08-15T00:00:00Z"),
    startDate: "2026-08-10",
    allDay: true,
  } as never;
  // Derselbe Urlaub, gelesen von einem Server in Europe/Berlin: ical.js legt
  // reine Datumsangaben auf die LOKALE Mitternacht, also zwei Stunden früher.
  const urlaubBerlin = {
    ...(urlaub as unknown as Record<string, unknown>),
    start: new Date("2026-08-09T22:00:00Z"),
    end: new Date("2026-08-14T22:00:00Z"),
  } as never;
  const termin = {
    uid: "t1",
    recurrenceId: "",
    summary: "Kinderarzt",
    start: new Date("2026-08-12T08:00:00Z"),
    end: new Date("2026-08-12T09:00:00Z"),
    allDay: false,
  } as never;

  it("zeigt den Urlaub an jedem Tag, den er deckt", async () => {
    const { groupByDay } = await import("./format");
    const tage = groupByDay([urlaub], new Date("2026-08-10T10:00:00Z")).map((g) => g.key);
    expect(tage).toEqual(["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"]);
  });

  it("beschriftet jeden Tag mit seinem eigenen Datum", async () => {
    const { groupByDay } = await import("./format");
    const g = groupByDay([urlaub], new Date("2026-08-10T10:00:00Z"));
    expect(g.map((x) => x.dayNumber)).toEqual(["10", "11", "12", "13", "14"]);
  });

  it("lässt Termine mit Uhrzeit an ihrem einen Tag", async () => {
    const { groupByDay } = await import("./format");
    const g = groupByDay([termin], new Date("2026-08-12T10:00:00Z"));
    expect(g.map((x) => x.key)).toEqual(["2026-08-12"]);
  });

  it("mischt beides am selben Tag", async () => {
    const { groupByDay } = await import("./format");
    const g = groupByDay([urlaub, termin], new Date("2026-08-12T10:00:00Z"));
    const zwoelf = g.find((x) => x.key === "2026-08-12");
    expect(zwoelf?.occurrences.map((o) => o.summary)).toEqual(["Urlaub Italien", "Kinderarzt"]);
  });

  // Das Briefing rechnet mit derselben Spanne wie die Woche — sonst sagt der
  // Assistent „bis Samstag", während die Liste am Freitag aufhört.
  it("nennt die Tage eines Ganztägigen einzeln", async () => {
    const { tageEinesVorkommens } = await import("./format");
    expect(tageEinesVorkommens(urlaub)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
    ]);
  });

  it("gibt einem eintägigen Ganztägigen genau einen Tag", async () => {
    const { tageEinesVorkommens } = await import("./format");
    const geburtstag = {
      uid: "g1",
      recurrenceId: "",
      summary: "Geburtstag Oma",
      start: new Date("2026-08-12T00:00:00Z"),
      end: new Date("2026-08-13T00:00:00Z"),
      startDate: "2026-08-12",
      allDay: true,
    } as never;
    expect(tageEinesVorkommens(geburtstag)).toEqual(["2026-08-12"]);
  });

  // Der Fehler, der uns fast durchgerutscht wäre: Wer den Instant statt
  // `startDate` befragt, bekommt auf einem Berliner Server den 9. dazu.
  it("liest denselben Urlaub in jeder Server-Zeitzone gleich", async () => {
    const { tageEinesVorkommens } = await import("./format");
    expect(tageEinesVorkommens(urlaubBerlin)).toEqual(tageEinesVorkommens(urlaub));
  });

  // Ende Oktober springt die Uhr zurück — die Dauer ist dann eine Stunde
  // länger als sechs Tage. Gezählt werden trotzdem sechs.
  it("zählt über die Sommerzeitgrenze richtig", async () => {
    const { tageEinesVorkommens } = await import("./format");
    const herbst = {
      uid: "h1",
      recurrenceId: "",
      summary: "Herbstferien",
      start: new Date("2026-10-24T22:00:00Z"), // 25.10. 00:00 Berlin (Sommerzeit)
      end: new Date("2026-10-30T23:00:00Z"), // 31.10. 00:00 Berlin (Winterzeit)
      startDate: "2026-10-25",
      allDay: true,
    } as never;
    expect(tageEinesVorkommens(herbst)).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
    ]);
  });
});
