import { describe, it, expect } from "vitest";
import { berlinParts, inWachzeit, titleKey, isCareGap, WACHZEIT } from "./gaps";

const keine = new Set<string>();
const ev = (startISO: string, endISO: string, extra: Partial<Parameters<typeof isCareGap>[0]> = {}) => ({
  uid: "u1",
  title: "Zahnarzt",
  start: new Date(startISO),
  end: new Date(endISO),
  allDay: false,
  hasCareDecision: false,
  ...extra,
});

describe("berlinParts", () => {
  it("rechnet Sommerzeit korrekt um (UTC+2)", () => {
    expect(berlinParts(new Date("2026-07-30T12:05:00Z"))).toEqual({ tag: "2026-07-30", minuten: 14 * 60 + 5 });
  });

  it("rechnet Winterzeit korrekt um (UTC+1)", () => {
    expect(berlinParts(new Date("2026-01-15T12:05:00Z"))).toEqual({ tag: "2026-01-15", minuten: 13 * 60 + 5 });
  });

  it("kippt spät abends nicht auf den falschen Tag", () => {
    // 22:30 UTC im Sommer ist in Berlin schon der Folgetag, 00:30.
    expect(berlinParts(new Date("2026-07-30T22:30:00Z"))).toEqual({ tag: "2026-07-31", minuten: 30 });
  });
});

describe("inWachzeit", () => {
  it("mittags: ja", () => {
    expect(inWachzeit(new Date("2026-07-30T12:00:00Z"), new Date("2026-07-30T13:00:00Z"), false)).toBe(true);
  });

  it("nachts: nein", () => {
    // 21:00–22:00 Berlin
    expect(inWachzeit(new Date("2026-07-30T19:00:00Z"), new Date("2026-07-30T20:00:00Z"), false)).toBe(false);
  });

  it("früh morgens vor der Wachzeit: nein", () => {
    // 05:00–06:00 Berlin
    expect(inWachzeit(new Date("2026-07-30T03:00:00Z"), new Date("2026-07-30T04:00:00Z"), false)).toBe(false);
  });

  it("ragt in die Wachzeit hinein: ja", () => {
    // 06:30–07:30 Berlin
    expect(inWachzeit(new Date("2026-07-30T04:30:00Z"), new Date("2026-07-30T05:30:00Z"), false)).toBe(true);
  });

  it("endet genau zum Beginn der Wachzeit: nein", () => {
    // 06:00–07:00 Berlin — Ende == Fenstergrenze, keine echte Überschneidung
    expect(inWachzeit(new Date("2026-07-30T04:00:00Z"), new Date("2026-07-30T05:00:00Z"), false)).toBe(false);
  });

  it("beginnt genau zum Ende der Wachzeit: nein", () => {
    // 20:00–21:00 Berlin
    expect(inWachzeit(new Date("2026-07-30T18:00:00Z"), new Date("2026-07-30T19:00:00Z"), false)).toBe(false);
  });

  it("ganztägige Einträge sind nie eine Betreuungsfrage", () => {
    expect(inWachzeit(new Date("2026-07-30T00:00:00Z"), new Date("2026-07-31T00:00:00Z"), true)).toBe(false);
  });

  it("über Mitternacht hinaus: ja", () => {
    expect(inWachzeit(new Date("2026-07-30T20:00:00Z"), new Date("2026-07-31T06:00:00Z"), false)).toBe(true);
  });

  it("Wachzeit ist 7 bis 20 Uhr", () => {
    expect(WACHZEIT).toEqual({ vonStunde: 7, bisStunde: 20 });
  });
});

describe("titleKey", () => {
  it("ignoriert Groß-/Kleinschreibung und Leerzeichen", () => {
    expect(titleKey("  Kinderarzt   Nicolas ")).toBe(titleKey("kinderarzt nicolas"));
  });

  it("ignoriert Satzzeichen", () => {
    expect(titleKey("Kinderarzt Nicolas | Impfung")).toBe("kinderarzt nicolas impfung");
  });

  it("behandelt Umlaute und Akzente gleich", () => {
    expect(titleKey("Café")).toBe(titleKey("Cafe"));
  });

  it("unterscheidet verschiedene Termine weiterhin", () => {
    expect(titleKey("Yoga")).not.toBe(titleKey("Zahnarzt"));
  });
});

describe("isCareGap", () => {
  it("offener Termin in der Wachzeit ist eine Lücke", () => {
    expect(isCareGap(ev("2026-07-30T12:00:00Z", "2026-07-30T13:00:00Z"), keine)).toBe(true);
  });

  it("bereits entschieden: keine Lücke", () => {
    expect(isCareGap(ev("2026-07-30T12:00:00Z", "2026-07-30T13:00:00Z", { hasCareDecision: true }), keine)).toBe(false);
  });

  it("abends: keine Lücke", () => {
    expect(isCareGap(ev("2026-07-30T19:00:00Z", "2026-07-30T20:00:00Z"), keine)).toBe(false);
  });

  it("einmal abgewinkter Titel fragt nie wieder — auch bei anderer Schreibweise", () => {
    const abgewinkt = new Set([titleKey("Müllabfuhr")]);
    const e = ev("2026-07-30T12:00:00Z", "2026-07-30T13:00:00Z", { title: "  müllabfuhr " });
    expect(isCareGap(e, abgewinkt)).toBe(false);
  });

  it("abgewinkter Titel blockiert andere Termine nicht", () => {
    const abgewinkt = new Set([titleKey("Müllabfuhr")]);
    expect(isCareGap(ev("2026-07-30T12:00:00Z", "2026-07-30T13:00:00Z", { title: "Zahnarzt" }), abgewinkt)).toBe(true);
  });
});
