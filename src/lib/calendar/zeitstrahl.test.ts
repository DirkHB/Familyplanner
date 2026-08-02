import { describe, it, expect } from "vitest";
import { buildStrahl, berlinStunde, dauerLabel, STANDARD_FENSTER } from "./zeitstrahl";

// Sommerzeit-Tag; 10:00 Berlin = 08:00 UTC.
const TAG = "2026-08-03";
const um = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 3, h - 2, m));

function ev(key: string, vonH: number, vonM: number, bisH: number, bisM: number) {
  return { key, start: um(vonH, vonM), end: um(bisH, bisM) };
}

describe("berlinStunde", () => {
  it("trifft die Stunde im Sommer", () => {
    expect(berlinStunde("2026-08-03", 7).toISOString()).toBe("2026-08-03T05:00:00.000Z");
  });

  it("trifft die Stunde im Winter", () => {
    expect(berlinStunde("2026-01-15", 7).toISOString()).toBe("2026-01-15T06:00:00.000Z");
  });
});

describe("dauerLabel", () => {
  it("unter einer Stunde in Minuten, sonst in Stunden", () => {
    expect(dauerLabel(45)).toBe("45 Min");
    expect(dauerLabel(120)).toBe("2 Std");
    expect(dauerLabel(90)).toBe("1½ Std");
    expect(dauerLabel(100)).toBe("1½ Std");
  });
});

describe("buildStrahl", () => {
  it("leerer Tag: ein freier Block übers ganze Fenster", () => {
    expect(buildStrahl([], TAG, STANDARD_FENSTER)).toEqual([
      { art: "frei", label: "frei · 14 Std" },
    ]);
  });

  it("Lücke am Morgen, zwischen Terminen und am Abend", () => {
    const s = buildStrahl([ev("a", 9, 0, 10, 0), ev("b", 14, 0, 15, 0)], TAG);
    expect(s).toEqual([
      { art: "frei", label: "frei · 2 Std" },
      { art: "termine", keys: ["a"] },
      { art: "frei", label: "frei · 4 Std" },
      { art: "termine", keys: ["b"] },
      { art: "frei", label: "frei · 6 Std" },
    ]);
  });

  it("kurze Lücken verschwinden — Übergang ist keine freie Zeit", () => {
    const s = buildStrahl([ev("a", 7, 0, 12, 0), ev("b", 12, 30, 21, 0)], TAG);
    expect(s).toEqual([
      { art: "termine", keys: ["a"] },
      { art: "termine", keys: ["b"] },
    ]);
  });

  it("Überschneidungen bilden eine Gruppe — die Karten stehen nebeneinander", () => {
    const s = buildStrahl(
      [ev("a", 10, 0, 11, 30), ev("b", 11, 0, 12, 0), ev("c", 15, 0, 16, 0)],
      TAG,
    );
    expect(s[1]).toEqual({ art: "termine", keys: ["a", "b"] });
    expect(s[3]).toEqual({ art: "termine", keys: ["c"] });
  });

  it("Termin vor dem Fenster erzeugt keine unsinnige Morgenlücke", () => {
    // 6:00–8:00 beginnt vor Fensterstart 7:00 — danach ist ab 8:00 frei.
    const s = buildStrahl([ev("frueh", 6, 0, 8, 0)], TAG);
    expect(s).toEqual([
      { art: "termine", keys: ["frueh"] },
      { art: "frei", label: "frei · 13 Std" },
    ]);
  });

  it("Termin über das Fensterende hinaus: keine negative Abendlücke", () => {
    const s = buildStrahl([ev("spaet", 20, 0, 22, 30)], TAG);
    expect(s[s.length - 1]).toEqual({ art: "termine", keys: ["spaet"] });
  });

  it("eigenes Fenster gilt", () => {
    const s = buildStrahl([], TAG, { vonStunde: 9, bisStunde: 18 });
    expect(s).toEqual([{ art: "frei", label: "frei · 9 Std" }]);
  });
});
