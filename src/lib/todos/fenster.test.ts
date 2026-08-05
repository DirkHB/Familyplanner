import { describe, it, expect } from "vitest";
import { waehleFenster, fensterLabel } from "./fenster";
import type { FreiBlock } from "@/lib/calendar/zeitstrahl";

// Montag, 3. August 2026, 12:00 Berlin (10:00 UTC).
const NOW = new Date("2026-08-03T10:00:00Z");
const uhr = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 3, h - 2, m)); // Berlin = UTC+2
const block = (vonH: number, bisH: number): FreiBlock => ({
  von: uhr(vonH),
  bis: uhr(bisH),
  minuten: (bisH - vonH) * 60,
});
// Tagesfenster endet 21:00 Berlin.
const TAGESENDE = uhr(21);

describe("waehleFenster", () => {
  it("nimmt den Block, der gerade läuft", () => {
    const w = waehleFenster([block(11, 14)], NOW, TAGESENDE);
    expect(w.art).toBe("fenster");
    expect(w.art === "fenster" && w.block.minuten).toBe(180);
  });

  it("stößt kurz vor dem Beginn an, damit man ankommt", () => {
    // Block beginnt 12:10, jetzt ist 12:00 — zehn Minuten Vorlauf.
    const w = waehleFenster([block(12, 14)], new Date(uhr(12, 10).getTime() - 10 * 60_000), TAGESENDE);
    expect(w.art).toBe("fenster");
  });

  it("wartet, solange der Block noch weit weg ist", () => {
    expect(waehleFenster([block(16, 18)], NOW, TAGESENDE).art).toBe("warten");
  });

  it("nimmt einen laufenden Block nicht mehr, wenn kaum Rest bleibt", () => {
    // Block 11:00–12:20, jetzt 12:00 → nur 20 Minuten übrig.
    const w = waehleFenster([{ von: uhr(11), bis: uhr(12, 20), minuten: 80 }], NOW, TAGESENDE);
    expect(w.art).toBe("warten");
  });

  it("gibt am Tagesende auch ohne Fenster einmal Bescheid", () => {
    const abends = uhr(20, 30);
    expect(waehleFenster([], abends, TAGESENDE).art).toBe("tagesende");
  });

  it("schweigt, wenn der Tag vorbei ist", () => {
    expect(waehleFenster([], uhr(22), TAGESENDE).art).toBe("warten");
  });

  it("bevorzugt das echte Fenster vor dem Tagesende-Notnagel", () => {
    const abends = uhr(20, 30);
    expect(waehleFenster([block(20, 21)], abends, TAGESENDE).art).toBe("fenster");
  });
});

describe("fensterLabel", () => {
  it("nennt Anfang und Ende", () => {
    expect(fensterLabel(block(14, 16))).toBe("14:00–16:00");
  });
});
