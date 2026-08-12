import { describe, it, expect } from "vitest";
import { zerlegeFeed, entfalte, abdruck } from "./ics-feed";
import { parseEvents, expandOccurrences } from "./ical";

const feed = (...zeilen: string[]) => zeilen.join("\r\n");

describe("Feed entfalten", () => {
  it("setzt umbrochene Zeilen wieder zusammen", () => {
    // RFC 5545 bricht lange Werte um und setzt sie mit einem Leerzeichen
    // fort. Wer das nicht zusammensetzt, liest eine halbe UID.
    expect(entfalte("SUMMARY:Sehr lan\r\n ger Titel")).toEqual(["SUMMARY:Sehr langer Titel"]);
    expect(entfalte("UID:abc\r\n\tdef")).toEqual(["UID:abcdef"]);
  });

  it("lässt gewöhnliche Zeilen in Ruhe", () => {
    expect(entfalte("A:1\r\nB:2")).toEqual(["A:1", "B:2"]);
  });
});

describe("Feed zerlegen", () => {
  it("macht aus zwei Terminen zwei Stücke", () => {
    const stuecke = zerlegeFeed(
      feed(
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Google//DE",
        "BEGIN:VEVENT", "UID:eins", "SUMMARY:Yoga",
        "DTSTART:20260810T090000Z", "DTEND:20260810T100000Z", "END:VEVENT",
        "BEGIN:VEVENT", "UID:zwei", "SUMMARY:Zahnarzt",
        "DTSTART:20260811T090000Z", "DTEND:20260811T100000Z", "END:VEVENT",
        "END:VCALENDAR",
      ),
    );
    expect(stuecke.map((s) => s.uid)).toEqual(["eins", "zwei"]);
    expect(stuecke[0].ics).toContain("SUMMARY:Yoga");
    expect(stuecke[0].ics).not.toContain("Zahnarzt");
  });

  it("gibt jedem Stück eine gültige Hülle mit", () => {
    const [s] = zerlegeFeed(
      feed(
        "BEGIN:VCALENDAR", "VERSION:2.0",
        "BEGIN:VEVENT", "UID:eins", "SUMMARY:Yoga",
        "DTSTART:20260810T090000Z", "DTEND:20260810T100000Z", "END:VEVENT",
        "END:VCALENDAR",
      ),
    );
    expect(s.ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(s.ics.endsWith("END:VCALENDAR")).toBe(true);
    // Und der vorhandene Parser kommt damit zurecht — darauf kommt es an.
    const ev = parseEvents(s.ics);
    expect(ev).toHaveLength(1);
    expect(ev[0].summary).toBe("Yoga");
  });

  it("nimmt die Zeitzone in jedes Stück mit", () => {
    // Ohne den VTIMEZONE-Block ist „DTSTART;TZID=Europe/Berlin" nicht
    // auswertbar — und die Wochenansicht zeigt die falsche Uhrzeit.
    const stuecke = zerlegeFeed(
      feed(
        "BEGIN:VCALENDAR", "VERSION:2.0",
        "BEGIN:VTIMEZONE", "TZID:Europe/Berlin",
        "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200",
        "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
        "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100",
        "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
        "END:VTIMEZONE",
        "BEGIN:VEVENT", "UID:eins", "SUMMARY:Yoga",
        "DTSTART;TZID=Europe/Berlin:20260810T090000",
        "DTEND;TZID=Europe/Berlin:20260810T100000", "END:VEVENT",
        "END:VCALENDAR",
      ),
    );
    expect(stuecke[0].ics).toContain("BEGIN:VTIMEZONE");
    expect(stuecke[0].ics).toContain("END:DAYLIGHT");

    const occ = expandOccurrences(
      stuecke[0].ics,
      new Date("2026-08-09T00:00:00Z"),
      new Date("2026-08-11T00:00:00Z"),
    );
    // 09:00 Berliner Sommerzeit ist 07:00 UTC.
    expect(occ[0].start.toISOString()).toBe("2026-08-10T07:00:00.000Z");
  });

  it("hält eine Serie und ihre Ausnahme zusammen", () => {
    // Beide tragen dieselbe UID. Getrennt überschrieben sie sich gegenseitig —
    // dieselbe Falle wie bei iCloud.
    const stuecke = zerlegeFeed(
      feed(
        "BEGIN:VCALENDAR", "VERSION:2.0",
        "BEGIN:VEVENT", "UID:serie", "SUMMARY:Schwimmkurs",
        "DTSTART:20260810T150000Z", "DTEND:20260810T160000Z",
        "RRULE:FREQ=WEEKLY;COUNT=3", "END:VEVENT",
        "BEGIN:VEVENT", "UID:serie", "SUMMARY:Schwimmkurs (fällt aus)",
        "RECURRENCE-ID:20260817T150000Z",
        "DTSTART:20260817T150000Z", "DTEND:20260817T160000Z", "END:VEVENT",
        "END:VCALENDAR",
      ),
    );
    expect(stuecke).toHaveLength(1);
    expect(stuecke[0].ics).toContain("RRULE:");
    expect(stuecke[0].ics).toContain("RECURRENCE-ID:");
    expect(parseEvents(stuecke[0].ics)).toHaveLength(2);
  });

  it("nimmt einen VALARM im Termin mit, ohne sich zu verschlucken", () => {
    const stuecke = zerlegeFeed(
      feed(
        "BEGIN:VCALENDAR", "VERSION:2.0",
        "BEGIN:VEVENT", "UID:eins", "SUMMARY:Yoga",
        "DTSTART:20260810T090000Z", "DTEND:20260810T100000Z",
        "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "END:VALARM",
        "END:VEVENT",
        "BEGIN:VEVENT", "UID:zwei", "SUMMARY:Danach",
        "DTSTART:20260810T110000Z", "DTEND:20260810T120000Z", "END:VEVENT",
        "END:VCALENDAR",
      ),
    );
    expect(stuecke.map((s) => s.uid)).toEqual(["eins", "zwei"]);
    expect(stuecke[0].ics).toContain("BEGIN:VALARM");
  });

  it("lässt weg, was keine UID hat", () => {
    // Ohne UID könnten wir den Termin beim nächsten Lauf nicht wiedererkennen
    // und legten ihn jedes Mal neu an.
    const stuecke = zerlegeFeed(
      feed(
        "BEGIN:VCALENDAR", "VERSION:2.0",
        "BEGIN:VEVENT", "SUMMARY:Ohne Kennung", "DTSTART:20260810T090000Z", "END:VEVENT",
        "END:VCALENDAR",
      ),
    );
    expect(stuecke).toEqual([]);
  });

  it("verträgt Leeres und Unsinn", () => {
    expect(zerlegeFeed("")).toEqual([]);
    expect(zerlegeFeed("kein Kalender")).toEqual([]);
    expect(zerlegeFeed("BEGIN:VCALENDAR\r\nEND:VCALENDAR")).toEqual([]);
  });

  it("gibt demselben Termin denselben Abdruck", () => {
    const eins = zerlegeFeed(
      feed("BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:a", "SUMMARY:X",
        "DTSTART:20260810T090000Z", "END:VEVENT", "END:VCALENDAR"),
    );
    const zwei = zerlegeFeed(
      feed("BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:a", "SUMMARY:X",
        "DTSTART:20260810T090000Z", "END:VEVENT", "END:VCALENDAR"),
    );
    expect(eins[0].etag).toBe(zwei[0].etag);

    const geaendert = zerlegeFeed(
      feed("BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:a", "SUMMARY:Y",
        "DTSTART:20260810T090000Z", "END:VEVENT", "END:VCALENDAR"),
    );
    expect(geaendert[0].etag).not.toBe(eins[0].etag);
  });

  it("kürzt den Abdruck auf eine handliche Länge", () => {
    expect(abdruck("irgendwas")).toHaveLength(32);
  });
});
