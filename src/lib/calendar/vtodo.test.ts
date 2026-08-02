import { describe, it, expect } from "vitest";
import { parseTodos, hasTodos } from "./vtodo";

function ics(body: string): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//DE", body, "END:VCALENDAR"].join(
    "\r\n",
  );
}

const OFFEN = ics(
  [
    "BEGIN:VTODO",
    "UID:abc-1@icloud.com",
    "SUMMARY:Windeln bestellen",
    "DESCRIPTION:Größe 3",
    "DUE;VALUE=DATE:20260810",
    "END:VTODO",
  ].join("\r\n"),
);

describe("parseTodos", () => {
  it("liest Titel, Notiz und Fälligkeit", () => {
    const [t] = parseTodos(OFFEN);
    expect(t.uid).toBe("abc-1@icloud.com");
    expect(t.summary).toBe("Windeln bestellen");
    expect(t.notes).toBe("Größe 3");
    expect(t.dueDate).toBeInstanceOf(Date);
    expect(t.done).toBe(false);
  });

  it("kommt ohne Fälligkeit und ohne Notiz aus", () => {
    const [t] = parseTodos(
      ics(["BEGIN:VTODO", "UID:x@y", "SUMMARY:Irgendwas", "END:VTODO"].join("\r\n")),
    );
    expect(t.dueDate).toBe(null);
    expect(t.notes).toBe(null);
  });

  it("nimmt Leerraum aus dem Titel", () => {
    const [t] = parseTodos(
      ics(["BEGIN:VTODO", "UID:x@y", "SUMMARY:  Milch  ", "END:VTODO"].join("\r\n")),
    );
    expect(t.summary).toBe("Milch");
  });
});

describe("erledigt erkennen", () => {
  // Der teuerste Fehler beim Import waere, abgehakte Erinnerungen als offene
  // Aufgaben zurueckzuholen. Deshalb alle drei Schreibweisen pruefen.
  it("über STATUS:COMPLETED, wie Apple es schreibt", () => {
    const [t] = parseTodos(
      ics(
        ["BEGIN:VTODO", "UID:x@y", "SUMMARY:Fertig", "STATUS:COMPLETED", "END:VTODO"].join("\r\n"),
      ),
    );
    expect(t.done).toBe(true);
  });

  it("über COMPLETED mit Zeitstempel", () => {
    const [t] = parseTodos(
      ics(
        [
          "BEGIN:VTODO",
          "UID:x@y",
          "SUMMARY:Fertig",
          "COMPLETED:20260801T100000Z",
          "END:VTODO",
        ].join("\r\n"),
      ),
    );
    expect(t.done).toBe(true);
  });

  it("über PERCENT-COMPLETE:100", () => {
    const [t] = parseTodos(
      ics(
        ["BEGIN:VTODO", "UID:x@y", "SUMMARY:Fertig", "PERCENT-COMPLETE:100", "END:VTODO"].join(
          "\r\n",
        ),
      ),
    );
    expect(t.done).toBe(true);
  });

  it("halb fertig ist nicht fertig", () => {
    const [t] = parseTodos(
      ics(
        ["BEGIN:VTODO", "UID:x@y", "SUMMARY:Halb", "PERCENT-COMPLETE:50", "END:VTODO"].join("\r\n"),
      ),
    );
    expect(t.done).toBe(false);
  });
});

describe("Abgrenzung zu Terminen", () => {
  it("ein Kalendereintrag liefert keine Aufgaben", () => {
    const termin = ics(
      [
        "BEGIN:VEVENT",
        "UID:e@y",
        "SUMMARY:Zahnarzt",
        "DTSTART:20260803T080000Z",
        "DTEND:20260803T090000Z",
        "END:VEVENT",
      ].join("\r\n"),
    );
    expect(parseTodos(termin)).toEqual([]);
    expect(hasTodos(termin)).toBe(false);
    expect(hasTodos(OFFEN)).toBe(true);
  });

  it("kaputte Daten kippen nicht den ganzen Import", () => {
    // Eine einzelne unlesbare Erinnerung darf den Rest nicht mitreißen.
    expect(parseTodos("kein ical")).toEqual([]);
    expect(hasTodos("")).toBe(false);
  });
});
