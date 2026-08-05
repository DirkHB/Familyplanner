import { describe, it, expect } from "vitest";
import { evaluateFrist, fristLabel } from "./frist";

// Montag, 3. August 2026, 12:00 Berlin (10:00 UTC).
const NOW = new Date("2026-08-03T10:00:00Z");
const inStunden = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

describe("evaluateFrist", () => {
  it("stößt an, wenn der Termin innerhalb eines Tages liegt", () => {
    const d = evaluateFrist({ status: "open", stichtag: inStunden(6), lastNudgeAt: null }, NOW);
    expect(d.anstossen).toBe(true);
    expect(d.stundenBis).toBeCloseTo(6);
  });

  it("lässt weit entfernte Anfragen dem täglichen Nudge", () => {
    expect(evaluateFrist({ status: "open", stichtag: inStunden(72), lastNudgeAt: null }, NOW).anstossen).toBe(false);
  });

  it("stößt nicht mehr an, wenn der Termin vorbei ist", () => {
    expect(evaluateFrist({ status: "open", stichtag: inStunden(-1), lastNudgeAt: null }, NOW).anstossen).toBe(false);
  });

  it("stößt höchstens einmal am Tag an", () => {
    const heuteFrueh = new Date("2026-08-03T06:00:00Z");
    expect(
      evaluateFrist({ status: "open", stichtag: inStunden(4), lastNudgeAt: heuteFrueh }, NOW).anstossen,
    ).toBe(false);
    // Gestern angestoßen zählt nicht mehr.
    const gestern = new Date("2026-08-02T16:00:00Z");
    expect(
      evaluateFrist({ status: "open", stichtag: inStunden(4), lastNudgeAt: gestern }, NOW).anstossen,
    ).toBe(true);
  });

  it("rührt beantwortete Anfragen und solche ohne Stichtag nicht an", () => {
    expect(evaluateFrist({ status: "answered", stichtag: inStunden(2), lastNudgeAt: null }, NOW).anstossen).toBe(false);
    expect(evaluateFrist({ status: "open", stichtag: null, lastNudgeAt: null }, NOW).anstossen).toBe(false);
  });
});

describe("fristLabel", () => {
  it("sagt heute, morgen oder den Wochentag", () => {
    expect(fristLabel(new Date("2026-08-03T16:00:00Z"), NOW)).toBe("heute 18:00");
    expect(fristLabel(new Date("2026-08-04T07:00:00Z"), NOW)).toBe("morgen 09:00");
    expect(fristLabel(new Date("2026-08-06T07:00:00Z"), NOW)).toContain("Do");
  });
});
