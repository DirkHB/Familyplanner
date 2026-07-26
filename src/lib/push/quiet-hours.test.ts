import { describe, it, expect } from "vitest";
import { isQuietHours, mergePrefs, DEFAULT_PREFS } from "./quiet-hours";

// Referenzzeiten als UTC; Berlin im Sommer = +2h.
const at = (utc: string) => new Date(utc);

describe("Ruhezeiten (21:00–07:00 Berlin)", () => {
  it("nachts still (23:00 Berlin = 21:00Z)", () => {
    expect(isQuietHours(at("2026-07-27T21:00:00Z"))).toBe(true); // 23:00 Berlin
  });
  it("früh morgens still (05:00 Berlin = 03:00Z)", () => {
    expect(isQuietHours(at("2026-07-27T03:00:00Z"))).toBe(true);
  });
  it("tagsüber nicht still (12:00 Berlin = 10:00Z)", () => {
    expect(isQuietHours(at("2026-07-27T10:00:00Z"))).toBe(false);
  });
  it("Grenzen: 07:00 Berlin nicht mehr still, 21:00 still", () => {
    expect(isQuietHours(at("2026-07-27T05:00:00Z"))).toBe(false); // 07:00 Berlin
    expect(isQuietHours(at("2026-07-27T19:00:00Z"))).toBe(true); // 21:00 Berlin
  });
});

describe("Fenster am selben Tag & leer", () => {
  it("13:00–14:00 Berlin", () => {
    expect(isQuietHours(at("2026-07-27T11:30:00Z"), "13:00", "14:00")).toBe(true); // 13:30
    expect(isQuietHours(at("2026-07-27T12:30:00Z"), "13:00", "14:00")).toBe(false); // 14:30
  });
  it("leeres Fenster (start==end) → nie still", () => {
    expect(isQuietHours(at("2026-07-27T21:00:00Z"), "00:00", "00:00")).toBe(false);
  });
});

describe("mergePrefs", () => {
  it("füllt Defaults", () => {
    expect(mergePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(mergePrefs({ requests: false }).requests).toBe(false);
    expect(mergePrefs({ requests: false }).quietStart).toBe("21:00");
  });
});
